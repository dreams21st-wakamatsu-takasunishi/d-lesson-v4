/**
* Package   ： 文章入力スピード認定試験エディタ（日本語・英語 共通）
* Title     ： 表示文字列定数定義ファイル
* Name      ： const_dsp_ed.js
* Create    ： 2021/01/12
* Update    ： 2022/03/31
*/

// ***** 初期画面メッセージ *****
// バージョン番号
// const version = "Ver.1.0.s1";
// const version = "Ver.1.0.00";
//MOD Start 20210831 mnt ファイル名禁止文字アラート・Firefox保存対応による番号変更
// const version = "Ver.1.0.01";
//MOD Start 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
// const version = "Ver.1.0.02";
//MOD Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
// const version = "Ver.1.0.03";
// const VERSION = "Ver.1.0.04"; // 20220331 yok 客先ご要望により rev107 では VerNo.カウントアップなしへ変更
const VERSION = "Ver.1.0.03";
//MOD End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
//MOD End-- 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
//MOD End-- 20210831 mnt ファイル名禁止文字アラート・Firefox保存対応による番号変更

const H1_TITLE_SHOKI_PAGE = "文章入力スピード認定試験";
const H2_TITLE_SHIKEN_GENGO_JP = "（日本語）";
const H2_TITLE_SHIKEN_GENGO_EN = "（英語）";
const BTN_JUKENSHA_TOUROKU = "受験者登録";
const BTN_SENNI_SHIKEN_GAMEN = "入力画面を開く";
const JUKENSHA_BANGO = "受験番号 ：";
const JUKENSHA_NAME = "　　名前 ：";
const FOOTER_KYOUKAI_NAME= "日本情報処理検定協会";
const TITLE_START_PAGE = H1_TITLE_SHOKI_PAGE + "初期画面";

// エラーメッセージ
const ERROR_MESSAGE1 = "受験番号を入力してください。";
const ERROR_MESSAGE2 = "名前を入力してください。";
const ERROR_MESSAGE3 = "受験者を登録してください。";
//ADD Start 20210804 mnt ファイル名禁止文字アラート表示対応
//MOD Start 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
// const FORBI_MESSAGE = "次の文字は使えません。" +"\n"+ ". \\ / : * ? \" < > |";
const FORBI_MESSAGE = "次の文字は使えません。" +"\n"+ " ! \" # $ % & ' * + , . / : ; < = > ? @ [ \\ ] ^ ` { | } ~";
//MOD End-- 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
//ADD End-- 20210804 mnt ファイル名禁止文字アラート表示対応

// インフォメーションメッセージ
const REGIS_INFO_MSG = "※受験番号・名前に誤りがある場合は<br>&nbsp;「受験者登録」ボタンをクリックし、<br>&nbsp;&nbsp;&nbsp;修正してください。";
// ***** 初期画面メッセージ *****　↑　↑　↑　ここまで

// ***** 認定試験画面文字列 *****
// タイトル文字列
const TITLE_CERT_PAGE = H1_TITLE_SHOKI_PAGE;

// 保存関連文字列
const BTN_HOZON = "保存";
const HOZON_MESSAGE = "保存しますか？";
const HOZON_DIALOG_TITLE = "保存確認";

// リセット関連文字列
const BTN_RESET = "リセット";
const RESET_KAKUNIN_MESSAGE = "内容をすべて削除しますか？";
const RESET_SAI_KAKUNIN_MESSAGE = "本当に削除しますか？";
const RESET_KAKUNIN_DIALOG_TITLE = "削除確認";
const RESET_SAI_KAKUNIN_DIALOG_TITLE = "削除再確認";

// 罫線関連文字列
const RDO_TITLE_KEISEN = "罫線:";
const RDO_TSUUJOU = "通常";
const RDO_KASEN = "下線";
const RDO_GRID_SEN = "グリッド線";

// 入力文字数表示文字列
const NYUURYOKU_MOJISUU = "入力文字数：";
const MOJISUU_UNIT = "文字";
const FRST_DISP_CNT = NYUURYOKU_MOJISUU + "0,000" + MOJISUU_UNIT;

// ***** 認定試験画面メッセージ *****　↑　↑　↑　ここまで

/* 正規表現 */
//ADD Start 20210804 mnt ファイル名禁止文字アラート表示対応
//MOD Start 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
// const FORBI_CHAR_REGEXP = /[.|\\|/|:|\*|?|\"|<|>|\|]/;
const FORBI_CHAR_REGEXP = /[.\\/:*?"<>|!@#$%^&+='`,;~[\]{}]/;
//MOD End-- 20220121 mnt 「 - _ 」以外の半角記号(ASCII)を入力禁止対応
//ADD End-- 20210804 mnt ファイル名禁止文字アラート表示対応

//ADD Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
/**
 * repeat()関数の実装（for IE）
 * 
 * @author ok
 * @create 20200901
 */
 if (!String.prototype.repeat) {                /* String.repeat が定義されていなければ… */
 String.prototype.repeat = function(count) {  /* …定義する。 */
   return Array(count*1+1).join(this);
 };
}
const SEPARATOR = "\n" + "-".repeat(32) + "\n";
//ADD End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応

// ADD Start 20220312 yok rev107 グリッドずれ調整箇所
const N_CHROME_SWITCH_96 = 96;
const S_CHROME_96_JP_CSS = "./css/cert-editor-jp_CR.css";
const S_CHROME_95_JP_CSS = "./css/cert-editor-jp_CR_old-arrange-grid.css";
const S_CHROME_96_EN_CSS = "./css/cert-editor-en_nbp_CR.css";
const S_CHROME_95_EN_CSS = "./css/cert-editor-en_nbp_CR_old-arrange-grid.css";
// ADD End   20220312 yok rev107 グリッドずれ調整箇所
