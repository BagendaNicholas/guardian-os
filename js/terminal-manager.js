// js/terminal-manager.js
import { sendCmd } from './utils.js';
import { esc } from './utils.js';

let currentUid = null;

export function initTerminal(uid) {
    if (!uid) return;
    currentUid = uid;
    setupShellListeners();
    setupFileBrowserListeners();
    attachEventHandlers();
}

// ── REMOTE SHELL ──────────────────────
function setupShellListeners() {
    import('./firebase-config.js').then(({ database, ref, onValue, addListener, removeListener }) => {
        const key = `feed-shell_output-${currentUid}`;
        removeListener(key);
        
        const listener = onValue(ref(database, `devices/${currentUid}/shell_output`), (snap) => {
            const o = document.getElementById('shell-output');
            if (!o || !snap.exists()) return;
            
            const d = snap.val();
            o.style.display = 'block';
            let text = '$ ' + (d.command || '') + '\n\n';
            
            if (d.exit_code === -999) {
                text += '⏳ Executing...\n';
            } else {
                text += (d.stdout || '(no output)');
                if (d.stderr) text += '\n\nSTDERR:\n' + d.stderr;
                text += '\n\nExit code: ' + (d.exit_code ?? '?');
                if (d.timed_out) text += ' ⚠️ TIMED OUT';
            }
            o.textContent = text;
            o.scrollTop = o.scrollHeight;
        });
        addListener(key, listener);
    });
}

// ─── FILE BROWSER ──────────────────────
function setupFileBrowserListeners() {
    import('./firebase-config.js').then(({ database, ref, onValue, addListener, removeListener }) => {
        const key = `feed-file_browser-${currentUid}`;
        removeListener(key);
        
        const listener = onValue(ref(database, `devices/${currentUid}/file_browser`), (snap) => {
            const o = document.getElementById('file-output');
            if (!o || !snap.exists()) return;
            
            const d = snap.val();
            o.style.display = 'block';
            
            if (d.error) {
                o.innerHTML = '<span style="color:#ff6b6b;"> ' + esc(d.error) + '</span>';
                return;
            }
            
            if (d.is_file) {
                renderFilePreview(o, d);
                return;
            }
            
            renderDirectoryList(o, d);
        });
        addListener(key, listener);
    });
}

function renderFilePreview(container, d) {
    let html = '<div style="margin-bottom:10px;">';
    if (d.preview_url) {
        const isVid = (d.file_type === 'video');
        html += `<div style="position:relative;display:inline-block;cursor:pointer;" onclick="window.open('${d.preview_url}', '_blank')">`;
        html += `<img src="${d.preview_url}" style="width:100%;max-width:300px;border-radius:6px;display:block;" loading="lazy">`;
        if (isVid) {
            html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:3px;"></div></div>';
        }
        html += '</div>';
    }
    html += `<div style="font-size:14px;color:#fff;margin-bottom:6px;margin-top:8px;">${esc(d.name || 'File')}</div>`;
    html += `<div style="color:#888;font-size:11px;">Size: ${d.size_formatted || '?'}</div>`;
    html += `<div style="color:#888;font-size:11px;">Type: ${d.file_type || 'unknown'}</div>`;
    html += `<div style="color:#888;font-size:11px;">Path: ${esc(d.absolute_path || d.current_path || '')}</div>`;
    html += '</div>';
    container.innerHTML = html;
}

// ✅ NEW: True File Explorer Rendering
function renderDirectoryList(container, d) {
    // Header with path and counts
    let html = `<div style="color:#00ff88;font-size:13px;margin-bottom:4px;word-break:break-all;">📂 ${esc(d.current_path || '/')}</div>`;
    html += `<div style="color:#666;font-size:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1a1a2e;">
                ${d.total_dirs || 0} folders • ${d.total_files || 0} files
             </div>`;
    
    const entries = d.entries || [];
    
    // Sort: Folders first, then files alphabetically
    const sorted = [...entries].sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(e => {
        const pathEsc = e.path.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        if (e.is_directory) {
            // 📁 FOLDER: Clickable to navigate inside
            html += `<div style="padding:10px 0;border-bottom:1px solid #111;cursor:pointer;display:flex;align-items:center;gap:10px;" 
                          onclick="navigateToFolder('${pathEsc}')">
                        <span style="font-size:20px;color:#ffd93d;">📁</span>
                        <div style="flex:1;min-width:0;">
                            <div style="color:#fff;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${esc(e.name)}
                            </div>
                            <div style="color:#555;font-size:9px;">
                                ${e.child_count ? `${e.child_count} items inside` : 'Empty folder'}
                            </div>
                        </div>
                        <span style="color:#444;font-size:16px;">›</span>
                    </div>`;
        } else {
            // 📄 FILE: Show icon + name + size (no thumbnail grid)
            const icon = getFileIcon(e.name);
            html += `<div style="padding:8px 0;border-bottom:1px solid #111;display:flex;gap:10px;align-items:center;">
                        <span style="font-size:18px;width:30px;text-align:center;">${icon}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${esc(e.name)}
                            </div>
                            <div style="color:#555;font-size:9px;">
                                ${e.size_formatted || ''}
                            </div>
                        </div>
                     </div>`;
        }
    });
    
    container.innerHTML = html;
}

// Helper to get file icon based on extension
function getFileIcon(filename) {
    if (!filename) return '📄';
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'jpg': '🖼️', 'jpeg': '️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
        'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', '3gp': '',
        'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵', 'aac': '', 'flac': '🎵',
        'pdf': '📕', 'doc': '📘', 'docx': '📘', 'txt': '📝', 'csv': '📊',
        'zip': '🗜️', 'rar': '️', '7z': '🗜️', 'tar': '🗜️',
        'apk': '📦', 'exe': '⚙️', 'bat': '️', 'sh': '⚙️',
        'html': '🌐', 'css': '🎨', 'js': '', 'json': '📋',
        'db': '🗄️', 'sqlite': '🗄️',
    };
    return icons[ext] || '📄';
}

// ─── EVENT HANDLERS ──────────────────────
function attachEventHandlers() {
    // Shell Run Button
    const sb = document.getElementById('cmd-shell');
    if (sb) sb.onclick = () => {
        const c = document.getElementById('shell-input')?.value?.trim() || 'ls /sdcard';
        sendCmd(currentUid, 'shell_command', c);
        const o = document.getElementById('shell-output');
        if (o) { o.style.display = 'block'; o.textContent = '⏳ Executing...'; }
    };

    // File Browser List Button
    const lfb = document.getElementById('cmd-listfiles');
    if (lfb) lfb.onclick = () => {
        const p = document.getElementById('file-path')?.value?.trim() || '/storage/emulated/0';
        sendCmd(currentUid, 'list_files', p);
        const o = document.getElementById('file-output');
        if (o) { o.style.display = 'block'; o.innerHTML = '<span style="color:#ffaa00;"> Loading...</span>'; }
    };
}

// Global helper for folder navigation (called from rendered HTML)
window.navigateToFolder = function(path) {
    if (!currentUid) return;
    sendCmd(currentUid, 'list_files', path.trim());
    const o = document.getElementById('file-output');
    if (o) { o.style.display = 'block'; o.innerHTML = `<span style="color:#ffaa00;"> Loading ${esc(path)}...</span>`; }
    const inp = document.getElementById('file-path');
    if (inp) inp.value = path.trim();
};
