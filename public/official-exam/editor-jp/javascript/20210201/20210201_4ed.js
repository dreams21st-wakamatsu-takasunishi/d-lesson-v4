/**
* Package   ： 文章入力スピード認定試験エディタ
* Title     ： 関数定義ファイル
* Name      ： 20210201_4ed.js
* Author    ： S-netplus(ok)
* Create    ： 2021/02/01 
* Update    ： 2022/03/29
*/

/**
 * 保存データの生成処理
 *
 * @param {Element} inpElm 入力データ要素
 * @param {String} temp 初期ページから受験番号と受験者名取得
 * @param {String} lang 言語記号
 * @param {String} y 年
 * @param {String} m 月
 * @param {String} d 日
 * @returns {String[]} ファイル名，答案データ
 * @author mnt
 */
//MOD Start 20210129 mnt チェックサム保存
// function genSaveData(lang, y, m, d) {
function genSaveData(inpElm, temp, lang, y, m, d) {
  var arry = [];
  var key;
  // $(".userinput").each(function () {
    // arry.push($(this).val());
  // for(let iel of inpElm ) {
  //   arry.push(iel.value);
  // }
  for (key in inpElm){
    arry.push(inpElm[key].value);
  }
  // });
  //MOD End-- 20210129 mnt チェックサム保存

  var txt = arry.join("");

  // 初期ページから受験番号と受験者名取得
  //MOD Start 20210129 mnt チェックサム保存
  // var temp = decodeURIComponent(window.location.search)
  //   .substring(1)
  //   .replace("受験番号:", "")
  //   .replace("&受験者名:", "_");
  temp = temp.substring(1)
             .replace("受験番号:", "")
             .replace("&受験者名:", "_");
  //MOD End-- 20210129 mnt チェックサム保存
  var fileName = lang + "-" + temp + "_" + y + m + d;

  // ADD Start 20210201 ok AddCheckSum
  // return [fileName, txt];
  // ADD Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
  txt += SEPARATOR + fileName + ".txt" + ", " + VERSION;
  // ADD End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
  return [fileName, txt + genChkSm(fileName, txt)];
  // ADD End-- 20210201 ok AddCheckSum
}
