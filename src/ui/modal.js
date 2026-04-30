export function showCustomAlert(msg) {
    let overlay = document.getElementById('custom-alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-alert-overlay';
        overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(overlay);
    }
    // ★ max-width を 500px に拡張し、文字が綺麗に収まるように変更
    overlay.innerHTML = `<div style="background:#fff; padding:30px; border-radius:15px; text-align:center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <p style="font-size:20px; color:#333; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;">${msg}</p>
            <button class="btn-primary" id="btn-custom-ok" style="padding: 10px 30px;">OK</button>
        </div>`;
    overlay.style.display = 'flex';
    document.getElementById('btn-custom-ok').onclick = () => { overlay.style.display = 'none'; };
}


export function showCustomConfirm(msg, onYes) {
    let overlay = document.getElementById('custom-confirm-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-confirm-overlay';
        overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center;';
        document.body.appendChild(overlay);
    }
    // ★ max-width を 500px に拡張
    overlay.innerHTML = `<div style="background:#fff; padding:30px; border-radius:15px; text-align:center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <p style="font-size:20px; color:#333; margin-bottom:20px; white-space:pre-wrap; line-height:1.5;">${msg}</p>
            <div style="display:flex; justify-content:center; gap:20px;">
                <button class="btn-primary" id="btn-custom-yes" style="padding: 10px 30px;">はい</button>
                <button class="btn-secondary" id="btn-custom-no" style="padding: 10px 30px;">いいえ</button>
            </div>
        </div>`;
    overlay.style.display = 'flex';
    document.getElementById('btn-custom-yes').onclick = () => { overlay.style.display = 'none'; onYes(); };
    document.getElementById('btn-custom-no').onclick = () => { overlay.style.display = 'none'; };
}
