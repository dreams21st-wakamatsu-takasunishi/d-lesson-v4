/**
* Package   ： 文章入力スピード認定試験エディタ（日本語）
* Title     ： 共通関数定義ファイル
* Name      ： common.js
* Create    ： 2020/07/01 
* Update    ： 2022/03/29
*/

const LANGUAGE = 'jp';

const HALF_SPACE = ' '; // 半角スペース
const FULL_SPACE = '\u3000'; // 全角スペース
const MAX_INPUT_LEN = 9999; // 入力最大文字数

const DEL_KCD = 46;
const BS_KCD = 8;
const UP_KCD = 38;
const DWN_KCD = 40;
const LFT_KCD = 37;
const RGT_KCD = 39;
const TAB_KCD = 9;
const SP_KCD = 32;
const SHFTSP_KCD = 229; // かな入力時のShift+Space
const ENT_KCD = 13;

// ブラウザ定数
const EDGE_OLD = 'edge_old';
const EDGE_NEW = 'edge_new';
const OPERA = 'opera';
const IE = 'ie';
const CHROME = 'chrome';
const FIREFOX = 'firefox';
const SAFARI = 'safari';

// 日付を取得
const today = new Date();
const year = today.getFullYear();
var month = String(today.getMonth() + 1);
if (month.length == 1) {
  month = '0' + month;
}
var day = String(today.getDate());
if (day.length == 1) {
  day = '0' + day;
}

//DEL Start 20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応
//---------------------------------------------------------------------------
// repeat()関数の実装チェックは、IEにて動作時、const_dsp_ed.js にて使用する。
// common.jsに当関数が存在していると「宣言前の使用」エラーが発生してしまうため、
// const_dsp_ed.js に移動する。
//---------------------------------------------------------------------------
///**
// * repeat()関数の実装（for IE）
// * 
// * @author ok
// * @create 20200901
// */
//if (!String.prototype.repeat) {                /* String.repeat が定義されていなければ… */
//  String.prototype.repeat = function(count) {  /* …定義する。 */
//    return Array(count*1+1).join(this);
//  };
//}
//DEL End   20220308 yok rev107 答案ファイル仕様追加（ファイル名＋Ver追記）対応

/**
 * 使用中のブラウザ判定
 *
 * @return {String} uaf ブラウザ名
 * @author mrt
 */
function userBrowser() {
  const ua = window.navigator.userAgent;
  var uaf = 'unknown';

  if(ua.indexOf('Edge') != -1) {
    uaf = EDGE_OLD;
  } else if(ua.indexOf('Edg') != -1) {
    uaf = EDGE_NEW;
  } else if (ua.indexOf('Trident') != -1 || ua.indexOf('MSIE') != -1) {
    uaf = IE;
  } else if (ua.indexOf('OPR') != -1 || ua.indexOf('Opera') != -1) {
    uaf = OPERA;
  } else if (ua.indexOf('Chrome') != -1) {
    uaf = CHROME;
  } else if (ua.indexOf('Firefox') != -1) {
    uaf = FIREFOX;
  } else if (ua.indexOf('Safari') != -1) {
    uaf = SAFARI;
  }
  return uaf;
}

// ブラウザの取得
var browser = userBrowser();

$(function () {
  var isOKCancel = false; // OK/Cancelボタン
  var candidateNo = '';   // 受験番号
  var candidateName = ''; // 受験者名

  /**
   * 受験者登録ボタンのクリック処理
   *
   * @author tht
   */
  $('.examStart button').click(function () {
    $('#isInsertData').dialog({
      // MOD Start 20210112 mnt 表示文字の定数定義ファイル化
      // title: '受験者登録',
      title: BTN_JUKENSHA_TOUROKU,
      // MOD End-- 20210112 mnt 表示文字の定数定義ファイル化
      width: 500,
      modal: false,
      resizable: false,
      buttons: {
        OK: function () {
          if (isEmpty($('#受験番号').val())) {
            alert(ERROR_MESSAGE1);
          } else if (isEmpty($('#受験者名').val())) {
            alert(ERROR_MESSAGE2);
          //ADD Start 20210804 mnt ファイル名禁止文字アラート表示対応
          } else if (FORBI_CHAR_REGEXP.test($('#受験番号').val())) {
            alert(FORBI_MESSAGE);
            $('#受験番号').focus();
          } else if (FORBI_CHAR_REGEXP.test($('#受験者名').val())) {
            alert(FORBI_MESSAGE);
            $('#受験者名').focus();
          //ADD End-- 20210804 mnt ファイル名禁止文字アラート表示対応
          } else {
            isOKCancel = true;
            candidateNo = $('#受験番号').val();
            candidateName = $('#受験者名').val();
            $(this).dialog('close');

            // ADD Start 受験番号と名前の表示位置
            // MOD Start 20210112 mnt 表示文字の定数定義ファイル化
            // document.getElementById('stuNo').innerHTML = '受験番号  ： ' + candidateNo;
            document.getElementById('stuNo').innerHTML = JUKENSHA_BANGO + candidateNo;
            // MOD End-- 20210112 mnt 表示文字の定数定義ファイル化
            document.getElementById('infoMsg').innerHTML = REGIS_INFO_MSG;              
            if (browser == IE) {  
            // MOD Start 20210112 mnt 表示文字の定数定義ファイル化
            // document.getElementById('stuName').innerHTML = FULL_SPACE.repeat(3) + '名前  ： '　+ candidateName;
            document.getElementById('stuName').innerHTML = FULL_SPACE + JUKENSHA_NAME + candidateName;
            // MOD End-- 20210112 mnt 表示文字の定数定義ファイル化
            } else {
            // MOD Start 20210112 mnt 表示文字の定数定義ファイル化
            // document.getElementById('stuName').innerHTML = FULL_SPACE.repeat(2) + '名前  ： '　+ candidateName;
            document.getElementById('stuName').innerHTML = JUKENSHA_NAME + candidateName;
            // MOD End-- 20210112 mnt 表示文字の定数定義ファイル化
            }
            // ADD End-- 受験番号と名前の表示位置
          }
        },
        キャンセル: function () {
          isOKCancel = true;
          $('#受験番号').val(candidateNo);
          $('#受験者名').val(candidateName);
          $(this).dialog('close');
        },
      },
      close: function () {
        if (!isOKCancel) {
          // OK／Cancelボタン以外
          $('#受験番号').val(candidateNo);
          $('#受験者名').val(candidateName);
          $(this).dialog('close');
        }
        isOKCancel = false;
      },
    });
  });

  /**
   * 保存ボタンをクリック（IE・Safari）
   *
   * @author mrt
   */
  // $('.profile .btnSave').click(function () { 
  $('.profile .btnSave_IE').click(function () {
    // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
    //MOD Start 20210129 mnt チェックサム保存
    // var result = genSaveData(LANGUAGE, year, month, day);
    var elm = $('.userinput');
    var tmp = decodeURIComponent(window.location.search);
    var result = genSaveData(elm, tmp, LANGUAGE, year, month, day);
    //MOD End-- 20210129 mnt チェックサム保存
    // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化

    // DEL Start 20210113 mnt 表示文字の定数定義ファイル化
    // if(browser == IE || browser == EDGE_OLD) {
    //   downloadIE(txt, fileName + '.txt');
    //   $(this).dialog('close');
    // } else if(browser == SAFARI) {
    //   downloadTrans(fileName, txt);
    //   $(this).dialog('close');
    // }
    // DEL End-- 20210113 mnt 表示文字の定数定義ファイル化

    $('#savewindow').dialog({
      // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
      // title: '認定試験保存確認',
      title: HOZON_DIALOG_TITLE,
      // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
      width: 400,
      modal: true,
      resizable: false,
      buttons: {
        はい: function () {
          // DEL Start 20210113 mnt 表示文字の定数定義ファイル化
          //   $('#isExit').dialog({
          //   title: '保存確認',
          //   width: 400,
          //   modal: true,
          //   resizable: false,
          //   buttons: {
          //     OK: function () {
          //       downloadTrans(fileName, txt);
          //     },
          //     キャンセル: function () {
          //       $(this).dialog('close');
          //     },
          //   },
          // });
          // DEL End-- 20210113 mnt 表示文字の定数定義ファイル化

          if(browser == IE || browser == EDGE_OLD) {
            downloadIE(result[1], result[0] + '.txt');

          } else if(browser == SAFARI) {
            downloadTrans(result[0], result[1]);
          //MOD Start 20210716 mnt FireFox対応(保存)
          // }
          }else if(browser == FIREFOX) {
            downloadTrans(result[0]+ '.txt', result[1]);
          }
          //MOD End-- 20210716 mnt FireFox対応(保存)
          $(this).dialog('close');
        },
        いいえ: function () {
          $(this).dialog('close');
        },
      },
    });
  });

  /**
   * Chrome版保存ボタンをクリック
   *
   * @author tht
   */
  // $('.profile .btnEnd').click(function () { //終了ボタン消去に伴い参照ボタン名変更
  $('.profile .btnSave_CR').click(function () {

    $('#popupwindow').dialog({
      // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
      // title: '保存確認',
      title: HOZON_DIALOG_TITLE,
      // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
      width: 400,
      modal: true,
      resizable: false,
      buttons: {
        はい: function () {

          // IE・EL・SF の時、保存せず終了画面へ遷移
          if(browser == IE　|| browser == SAFARI || browser == EDGE_OLD) {
            $('#isExit').dialog({
              title: '保存確認',
              width: 400,
              modal: true,
              resizable: false,
              buttons: {
                はい: function () {
                  window.location.href = './end.html';
                  textClear();
                  // ADD Start 遷移後ダイアログボックス閉じる
                  $(this).dialog('close');
                  // ADD End-- 遷移後ダイアログボックス閉じる
                },
                いいえ: function () {
                  $(this).dialog('close');
                },
              },
            });

          // CR・ED の時、保存処理実施
          } else if (browser == EDGE_NEW || browser == CHROME) {
            //MOD Start 20210129 mnt チェックサム保存
            // var result = genSaveData(LANGUAGE, year, month, day);
            var elm = $('.userinput');
            var tmp = decodeURIComponent(window.location.search);
            var result = genSaveData(elm, tmp, LANGUAGE, year, month, day);
            //MOD End-- 20210129 mnt チェックサム保存

            // ダウンロード処理を実施。
            // MOD Start 20210803 mnt 半角ピリオド入ファイル名ダウンロード不具合
            //downloadTrans(result[0], result[1]);
            downloadTrans(result[0] + '.txt', result[1]);
            // MOD End-- 20210803 mnt 半角ピリオド入ファイル名ダウンロード不具合
          }
          $(this).dialog('close');
        },
        いいえ: function () {
          $(this).dialog('close');
        },
      },
    });
  });

  /**
   * リセットボタンのクリック処理
   *
   * @author tht
   */
  $('.reset button').click(function () {
    $('#isReset').dialog({
      // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
      // title: '削除確認',
      title: RESET_KAKUNIN_DIALOG_TITLE,
      // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
      width: 400,
      modal: true,
      resizable: false,
      buttons: {
        OK: function () {
          // 「削除確認」ポップアップが表示
          $('#Reset').dialog({
            // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
            //title: '削除再確認',
            title: RESET_SAI_KAKUNIN_DIALOG_TITLE,
            // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
            width: 400,
            modal: true,
            resizable: false,
            buttons: {
              OK: function () {
                textClear();
                $(this).dialog('close');
              },
              キャンセル: function () {
                $(this).dialog('close');
              },
            },
            // ADD Start 20210114 mnt 初期フォーカス
            close: function() {
              // 入力エリアにフォーカスセット
              $('.userinput').eq(0).focus();
            }
            // ADD End-- 20210114 mnt 初期フォーカス
          });
          $(this).dialog('close');
        },
        キャンセル: function () {
          $(this).dialog('close');
        },
      },
      // ADD Start 20210114 mnt 初期フォーカス
      close: function() {
        // 入力エリアにフォーカスセット
        $('.userinput').eq(0).focus();
      }
      // ADD End-- 20210114 mnt 初期フォーカス
    });
  });

  /**
  /* 「試験開始」ボタンのクリック処理
   *
   * @author tht
   */
  $('#startExam').click(function () {
    if (!(isEmpty($('#受験番号').val()) || isEmpty($('#受験者名').val()))) {
      var rollNo = $('#受験番号').val();
      var studentName = $('#受験者名').val();

      // MOD Start 前後のスペースを削除
      //// 受験者名からスペースを除去する
      // studentName = studentName.replace(/\s+/g, '');
      studentName = studentName.trim();
      // MOD End-- 前後のスペースを削除

      // 「検定試験画面」へ移動
      var result = '受験番号:' + rollNo + '&受験者名:' + studentName;

      if (browser == IE) {
        // MOD Start 20210114 mnt 表示文字の定数定義ファイル化
        // window.location.href = './editor-jp/cert-ex_editorIE.html' + '?' + result; 
        window.location.href = './editor-jp/cert-editor-jp_IE.html' + '?' + result; 
        // MOD End-- 20210114 mnt 表示文字の定数定義ファイル化

      //MOD Start 20210716 mnt FireFox対応(保存)
      // } else if (browser == EDGE_OLD){
      } else if (browser == EDGE_OLD || browser == FIREFOX){
      //MOD End-- 20210716 mnt FireFox対応(保存)
        // MOD Start 20210114 mnt 表示文字の定数定義ファイル化
        // window.location.href = './editor-jp/cert-ex_editorEL.html' + '?' + result; 
        window.location.href = './editor-jp/cert-editor-jp_EL.html' + '?' + result; 
        // MOD End-- 20210114 mnt 表示文字の定数定義ファイル化

      } else if (browser == SAFARI) {
        // MOD Start 20210114 mnt 表示文字の定数定義ファイル化
        // window.location.href = './editor-jp/cert-ex_editorSF.html' + '?' + result; 
        window.location.href = './editor-jp/cert-editor-jp_SF.html' + '?' + result; 
        // MOD End-- 20210114 mnt 表示文字の定数定義ファイル化

      } else {
        // クロムとEdgeの場合、画面遷移
        // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
        // window.open('./editor-jp/cert-ex_editorCR.html' + '?' + result, '_blank');
        window.open('./editor-jp/cert-editor-jp_CR.html' + '?' + result, '_blank');
        // MOD End-- 20210114 mnt 表示文字の定数定義ファイル化
        (window.open('', '_self').opener = window).close();
      }
    } else {
      alert(ERROR_MESSAGE3);
    }
  });
});


// ADD Start 20210113 mnt 表示文字の定数定義ファイル化
// DEL Start 20210201 ok AddCheckSum → 20210201_4ed.js へ移設
/**
 * 保存データの生成処理
 *
 * @param {String} lang 言語記号
 * @param {String} y 年
 * @param {String} m 月
 * @param {String} d 日
 * @returns {String[]} ファイル名，答案データ
 * @author mnt
 */
// function genSaveData(lang, y, m, d) {
//   var arry = [];
//   $('.userinput').each(function () {
//     arry.push($(this).val());
//   });
//
//   var txt = arry.join('');
//
//   // 初期ページから受験番号と受験者名取得
//   var temp = decodeURIComponent(window.location.search)
//     .substring(1)
//     .replace('受験番号:', '')
//     .replace('&受験者名:', '_');
//   var fileName = lang + '-' + temp + '_' + y + m + d;
//
//   return [fileName, txt];
// }
// DEL End-- 20210201 ok AddCheckSum → 20210201_4ed.js へ移設
// ADD End-- 20210113 mnt 表示文字の定数定義ファイル化

/**
 * ダウンロード処理
 *
 * @param {String} filename ファイル名
 * @param {String} text 書込み内容
 * @author tht
 */
function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
  );
  element.setAttribute('download', filename);
  element.target = '_blank';
  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

/**
 * 確実なダウンロード処理
 * 　（非同期処理対応）
 *
 * @param {String} filename ファイル名
 * @param {String} text 書込み内容
 * @param {Number} msec 待ち時間（ミリ秒）
 * @return {Promise}    ('遷移先画面名')
 * @author ok
 */
function secureDownload(filename, text, msec) {
  return new Promise(function (resolve) {
    // 複数ファイルダウンロード処理を実施。
    download(filename, text);

    // ダウンロードの完了を「待ち時間」の間待った後、
    // ファンクションを終了。
    setTimeout(function () {
      resolve('end.html');
    }, msec);
  });
}

/**
 * ダウンロード後に画面遷移
 *
 * @param {String} filename ファイル名
 * @param {String} text 書込み内容
 * @author ok
 */
function downloadTrans(filename, text) {
    // **確実なダウンロード処理を実施。(1.5秒待機)**
    secureDownload(filename, text, 1500).then(function (toPage) {
    // **ダウンロードが終了してから、**
    // **検定試験終了画面へ遷移**
    /* DEL Start 保存確認ダイアログボックス不要の為削除 */
    //// 画面遷移確認ダイアログ 
    // if(browser != SAFARI) {
    //   cfrmExitDlg(toPage); 
    // }
    /* DEL End-- 保存確認ダイアログボックス不要の為削除 */
  });
}

/**
 * IE用のダウンロード機能
 *
 * @param {String} content  書込み内容
 * @param {String} filename ファイル名
 */
function downloadIE(content, filename) {

  var mimeType = 'text/plain';
  var blob = new Blob([content], {type: mimeType});

  var a = document.createElement('a');
  a.download = filename;
  a.target = '_self';
  window.navigator.msSaveBlob(blob, filename);
}

/**
 * ヘッダー設定
 *
 * @param {String} lang 言語
 * @author tht
 */
function editHeader(lang) {
  // タイトルの設定
  var title =
  // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
  // '文章入力スピード認定試験（' + (lang == 'en' ? '英語' : '日本語') + '）';
  H1_TITLE_SHOKI_PAGE + (lang == 'en' ? H2_TITLE_SHIKEN_GENGO_EN : H2_TITLE_SHIKEN_GENGO_JP);
  // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化

  document.getElementById('title').innerHTML = title;

  //// 受験日の表示
  // const annoDomini = year + '年' + month + '月' + day + '日';
  // document.getElementById('date').innerHTML = '受験日：' + annoDomini;

  // 受験番号・受験者の設定
  var stuInfo = decodeURIComponent(window.location.search);
  stuInfo = stuInfo.substring(1);
  var strArr = stuInfo.split('&');
  var rollNo = strArr[0];
  var sName = strArr[1];

  // MOD Start 受験番号と名前の表示位置
  var stuName = sName.replace('受験者名','名前');
  if (browser == IE) {
    document.getElementById('studentName').innerHTML = FULL_SPACE.repeat(3) + stuName.replace(':','  ： ');
    document.getElementById('rollNo').innerHTML = rollNo.replace(':','  ： ');
  } else {
    document.getElementById('studentName').innerHTML = FULL_SPACE.repeat(2) + stuName.replace(':','： ');
    document.getElementById('rollNo').innerHTML = rollNo.replace(':','： ');
  }
  // MOD End-- 受験番号と名前の表示位置

  // DEL Start 終了処理削除
  // 終了・保存ボタン
  //if (browser == IE || browser == SAFARI || browser == EDGE_OLD) {
    // var btnSave = document.getElementsByClassName('btnSave')[0];
    // btnSave.classList.remove('hidden');

    // var btnEnd = document.getElementsByClassName('btnEnd')[0];
    // btnEnd.textContent = '終了';
  //}
  // DEL End-- 終了処理削除
}

/**
 * 和暦の取得
 *
 * @return {String} 和暦 + '年度'
 * @author mrt
 */
function getJapaneseCalendar() {
  // 元号の情報
  var jaCalender = [
    {
      era: '明治',
      start: '1868/1/25'
    },
    {
      era: '大正',
      start: '1912/7/30'
    },
    {
      era: '昭和',
      start: '1926/12/25'
    },
    {
      era: '平成',
      start: '1989/1/8'
    },
    {
      era: '令和',
      start: '2019/5/1'
    },
  ];

  for (var i = jaCalender.length - 1; i >= 0; i--) {
    var t = new Date(jaCalender[i]['start']);
    // 元号の範囲に入っている場合
    if (today >= t) {
      // 和暦に変換して返す
      return jaCalender[i]['era'] + (today.getFullYear() - t.getFullYear() + 1) + '年度';
    }
    // 設定した元号の範囲に入らなかった場合
    if (i <= 0) {
      return '対象範囲外です';
    }
  }
}

/**
 * リセットボタンの動作
 *
 * @author tht
 */
function textClear() {
  $('.userinput').each(function (index) {
    if (index == 0) {
      $(this).val('');
    } else {
      $(this).parent().parent().remove();
    }
  });
  // ADD Start 入力文字数カウンタ
  document.getElementsByClassName('letr-cnt')[0].innerHTML = FRST_DISP_CNT;
  // ADD End-- 入力文字数カウンタ
}

/**
 * 文字列の空判定
 *
 * @param {String} str 文字列
 * @return {Boolean} 判定結果
 * @author mrt
 */
function isEmpty(str) {
  if (
    typeof str == 'string' &&
    (str == undefined || str == null || str == '')
  ) {
    return true;
  }
  return false;
}

// ADD Start 入力文字数カウンタ
/**
 * 文字数カウント及び表示（全角空白用）
 *
 * @param {Element[]} pages
 * @returns なし
 * @author ok
*/
function DispLetterCount(pages) {
  var total_val = '';
  var total_len = 0;
  var sub = 0;

  for ( var i = 0 ; i < pages.length; i++) {
    total_val = total_val + pages[i].value;
  }
  total_len = total_val.replace(new RegExp(FULL_SPACE.repeat(TAB_COUNT), 'g'),FULL_SPACE).length;
  var re = document.getElementsByClassName('letr-cnt');
  // MOD Start　入力文字数最大文字数を超えた場合
  var disp_lt = '';
  if (total_len <= MAX_INPUT_LEN) {
    // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
    //disp_lt = '入力文字数：' + ( HALF_SPACE.repeat(5) + total_len.toLocaleString() ).slice(-5).replace(new RegExp(HALF_SPACE, 'g'),'&ensp;') + '文字';
    disp_lt = NYUURYOKU_MOJISUU + ( HALF_SPACE.repeat(5) + total_len.toLocaleString() ).slice(-5).replace(new RegExp(HALF_SPACE, 'g'),'&ensp;') + MOJISUU_UNIT;
    // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
  } else {
    // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
    // disp_lt = '入力文字数：' + '&ensp;*,***' + '文字';
    disp_lt = NYUURYOKU_MOJISUU + '&ensp;*,***' + MOJISUU_UNIT;
    // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
  }
  for ( var i = 0 ; i < re.length; i++) {
    re[i].innerHTML = disp_lt;
  }
  // MOD End--　入力文字数最大文字数を超えた場合
}
// ADD End   入力文字数カウンタ

// MOD Start 20220312 yok rev107 グリッドずれ調整箇所
/**
 * Chromeバージョンによる、Grid線CSSの切替
 *
 * @param lang 'jp':日本版CSS読込，'en':英語版CSS読込
 * @return なし
 * @author yok
 */
 function switchGridByChromeVer(lang){
  if (/Chrome\/\d{2}/.test(navigator.userAgent)) {
  // MOD Start 20220404 yok rev107a Chromeバージョン番号取得不具合修正（グリッドずれ調整後）
    // let res = parseInt(navigator.userAgent
    //                       .match(/Chrome\/.{3}/).toString()
    //                       .replace(/^Chrome\//,'')
    //                       .replace(/.$/,'')); // ← NG
    let res = parseInt(navigator.userAgent
                        .match(/Chrome\/.{3}/).toString()
                        .replace(/^Chrome\//,'')
                        .replace(/\.$/,''));
  // MOD End   20220404 yok rev107a Chromeバージョン番号取得不具合修正（グリッドずれ調整後）
    if ( res >= N_CHROME_SWITCH_96 ) {
      // Chrome 96 から 新調整CSS適用
      if ( lang === 'en' ) {
        document.getElementById('ChromeCSS').href = S_CHROME_96_EN_CSS;
      } else {
        document.getElementById('ChromeCSS').href = S_CHROME_96_JP_CSS;
      }
    } else {
      // Chrome 95 まで 旧CSS適用
      if ( lang === 'en' ) {
        document.getElementById('ChromeCSS').href = S_CHROME_95_EN_CSS;
      } else {
        document.getElementById('ChromeCSS').href = S_CHROME_95_JP_CSS;
      }
    }
  }
}
// MOD End   20220312 yok rev107 グリッドずれ調整箇所



/* ↓　↓　↓　↓　↓　↓　↓　↓　↓　↓　↓　↓ */
/* ↓　↓　↓　以降 不使用メソッド ↓　↓　↓　↓ */
/* ↓　↓　↓　↓　↓　↓　↓　↓　↓　↓　↓　↓ */

/**
 * ダウンロード後にダイアログ表示
 *
 * @param {String} toPage url
 * @author tht 2020/09/02
 */
function cfrmExitDlg(toPage){
  $('#isExit').dialog({
    title: '保存確認',
    width: 400,
    modal: true,
    resizable: false,
    buttons: {
      はい: function () {
        // **履歴削除のため新規タブで開く**
        // window.location = toPage;　（← 現タブで画面遷移。）
        window.open(toPage, '_blank');
        if(browser != SAFARI) {
          (window.open('', '_self').opener = window).close();
        }
      },
      いいえ: function () {
        $(this).dialog('close');
      },
    },
  });
}

//   /**
//    * 保存ボタンをクリック（IE・Safari）***不使用メソッド***
//    *
//    * @author mrt
//    */
//   // $('.profile .btnSave').click(function () { //不使用のため参照ボタン名変更
//   $('.profile .btnSave_IE').click(function () {
//     var arry = [];
//   $('.userinput').each(function () {
//     arry.push($(this).val());
//   });

//   var txt = arry.join('');
//   var result = decodeURIComponent(window.location.search);
//   result = result.substring(1);

//   // 初期ページから受験番号と受験者名取得
//   var temp = decodeURIComponent(window.location.search)
//     .substring(1)
//     .replace('受験番号:', '')
//     .replace('&受験者名:', '_');
//   var fileName = LANGUAGE + '-' + temp + '_' + year + month + day;

//   if(browser == IE || browser == EDGE_OLD) {
//     downloadIE(txt, fileName + '.txt');
//     $(this).dialog('close');
//   } else if(browser == SAFARI) {
//     downloadTrans(fileName, txt);
//     $(this).dialog('close');
//   }
//   $('#savewindow').dialog({
//     title: '認定試験保存確認',
//     width: 400,
//     modal: true,
//     resizable: false,
//     buttons: {
//       はい: function () {
//          $('#isExit').dialog({
//           title: '保存確認',
//           width: 400,
//           modal: true,
//           resizable: false,
//           buttons: {
//             OK: function () {
//               downloadTrans(fileName, txt);
//             },
//             キャンセル: function () {
//               $(this).dialog('close');
//             },
//           },
//         });
//         $(this).dialog('close');       
//       },
//       いいえ: function () {
//         $(this).dialog('close');
//       },
//     },
//   });
// });

// /**
//  * 保存・認定終了ボタンをクリック
//  *
//  * @author tht
//  */
// // $('.profile .btnEnd').click(function () { //終了ボタン消去に伴い参照ボタン名変更
// $('.profile .btnSave_CR').click(function () {
//     $('#popupwindow').dialog({
//     // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
//     // title: '保存確認',
//     title: HOZON_DIALOG_TITLE,
//     // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
//     width: 400,
//     modal: true,
//     resizable: false,
//     buttons: {
//       はい: function () {

//         if(browser == IE　|| browser == SAFARI || browser == EDGE_OLD) {
//           $('#isExit').dialog({
//             // MOD Start 20210113 mnt 表示文字の定数定義ファイル化
//             // title: '保存確認',
//             title: HOZON_DIALOG_TITLE,
//             // MOD End-- 20210113 mnt 表示文字の定数定義ファイル化
//             width: 400,
//             modal: true,
//             resizable: false,
//             buttons: {
//               はい: function () {
//                 window.location.href = './end.html'; 
//                 textClear();
//               },
//               いいえ: function () {
//                 $(this).dialog('close');
//               },
//             },
//           });

//         } else if (browser == EDGE_NEW || browser == CHROME) {

//             // 複数ファイルダウンロード処理を実施。
//             var arry = [];
//             $('.userinput').each(function () {
//               arry.push($(this).val());
//             });
      
//             var txt = arry.join('');
//             var result = decodeURIComponent(window.location.search);
//             result = result.substring(1);
      
//             // 初期ページから受験番号と受験者名取得
//             var temp = decodeURIComponent(window.location.search)
//               .substring(1)
//               .replace('受験番号:', '')
//               .replace('&受験者名:', '_');
//             var fileName = LANGUAGE + '-' + temp + '_' + year + month + day;
//             downloadTrans(fileName, txt);
//         }
//         $(this).dialog('close');
//       },
//       いいえ: function () {
//         $(this).dialog('close');
//       },
//     },
//   });
// });
