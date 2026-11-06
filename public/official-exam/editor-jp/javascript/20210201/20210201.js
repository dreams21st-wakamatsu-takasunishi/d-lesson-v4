/**
* Package   ： 文章入力スピード認定試験ツール共通
* Title     ： 関数定義ファイル
* Name      ： 20210201.js
* Author    ： S-netplus(ok)
* Create    ： 2021/02/01 
* Update    ： 2022/03/08
*/

/**
 * チェックサムの生成処理
 *
 * @param {String} flName ファイル名（拡張子なし）
 * @param {String} cont ファイル内容
 * @returns {String} MD5チェックサム
 * @author ok
 */
function genChkSm(flName, cont) {
    // DEL Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
    // var dlm = "\n" + "-".repeat(32) + "\n";
    // DEL End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
    var h = md5(flName + cont);
    // MOD Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
    // return dlm + h;
    return SEPARATOR + h;
    // MOD End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
}
