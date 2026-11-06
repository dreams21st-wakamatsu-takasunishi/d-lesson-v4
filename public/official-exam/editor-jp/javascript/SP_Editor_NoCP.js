/**
* Name      ： SP_Editor_NoCP.js
* Create    ： 
* Update    ： 2022/03/22
 */
/* 右クリック禁止 */
document.oncontextmenu = function () {return false;}
document.oncopy = function () {return false;}
document.onpaste = function () {return false;}
document.oncut = function () {return false;}

// ADD Start 20211223 mnt rev107 ページリロード・戻る・閉じる機能抑制
window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    e.returnValue = '';
});
// ADD End-- 20211223 mnt rev107 ページリロード・戻る・閉じる機能抑制
