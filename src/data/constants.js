export const GRADE_ORDER =["未就学", "小学1年", "小学2年", "小学3年", "小学4年", "小学5年", "小学6年", "中学1年", "中学2年", "中学3年", "高校1年", "高校2年", "高校3年", "おとな", "学年未設定"];

export const VISION_STAGES =[
    { id: 'v1', title: 'じゅんばんタッチ', sub: 'めをすばやくうごかそう', icon: '🔢', color: '#2196F3' },
    { id: 'v2', title: 'まちがいさがし', sub: 'ちがうもじをみつけよう', icon: '🔍', color: '#FF9800' },
    { id: 'v3', title: 'ロックオン', sub: 'まとをマウスでおおいかけよう', icon: '🎯', color: '#F44336' },
    { id: 'v4', title: 'フラッシュきおく', sub: 'いっしゅんでおぼえよう', icon: '⚡', color: '#9C27B0' },
    { id: 'v5', title: 'さがしもの', sub: 'おなじえをぜんぶみつけよう', icon: '🍎', color: '#E91E63' },
    { id: 'v6', title: 'もぐらたたき', sub: 'でてきたらすぐクリック！', icon: '🔨', color: '#795548' },
    { id: 'v7', title: 'メモリーゲーム', sub: 'ひかったじゅんばんをおぼえよう', icon: '🧠', color: '#00BCD4' },
    { id: 'v8', title: 'なぞりめいろ', sub: 'みちからはみださないようにすすもう', icon: '〰️', color: '#4CAF50' },
    { id: 'v9', title: 'むきあてクイズ', sub: 'おなじむきのものをえらぼう', icon: '🔄', color: '#673AB7' },
    { id: 'v10', title: 'ワイドスキャン', sub: 'ひろいはんいをすばやくみよう', icon: '↔️', color: '#00897B' },
    { id: 'v11', title: 'まわりキャッチ', sub: 'まんなかをみながらまわりにきづこう', icon: '✚', color: '#3949AB' },
    { id: 'v12', title: 'かたちあわせ', sub: 'いろとかたちをみくらべよう', icon: '◆', color: '#D81B60' },
    { id: 'v13', title: 'ダブルチェック', sub: '番号と形を見くらべよう', icon: '✅', color: '#6D4C41' },
    { id: 'v14', title: '左右チェック', sub: '左右を見くらべて判断しよう', icon: '↔️', color: '#0277BD' },
    { id: 'v15', title: 'カラーキャッチ', sub: 'いろとかたちをすばやくえらぼう', icon: '🎨', color: '#2E7D32' },
    { id: 'v16', title: 'せんたどり', sub: 'つながったゴールを目でたどろう', icon: '➿', color: '#1565C0' },
    { id: 'v17', title: 'パターンきおく', sub: '色とかたちのならびをおぼえよう', icon: '🧩', color: '#6A1B9A' },
    { id: 'v18', title: 'かげあわせ', sub: 'かげと同じ形をえらぼう', icon: '🌗', color: '#455A64' },
    { id: 'v19', title: 'ばしょきおく', sub: '光った場所をおぼえよう', icon: '📍', color: '#00838F' },
    { id: 'v20', title: 'かくれたかたち', sub: '一部だけ見える形を考えよう', icon: '🧩', color: '#5D4037' }
];

export const KANA_MAP = {
    'あ':'A','い':'I','う':'U','え':'E','お':'O',
    'か':'KA','き':'KI','く':'KU','け':'KE','こ':'KO',
    'さ':'SA','し':'SHI','す':'SU','せ':'SE','そ':'SO',
    'た':'TA','ち':'CHI','つ':'TSU','て':'TE','と':'TO',
    'な':'NA','に':'NI','ぬ':'NU','ね':'NE','の':'NO',
    'は':'HA','ひ':'HI','ふ':'FU','へ':'HE','ほ':'HO',
    'ま':'MA','み':'MI','む':'MU','め':'ME','も':'MO',
    'や':'YA','ゆ':'YU','よ':'YO',
    'ら':'RA','り':'RI','る':'RU','れ':'RE','ろ':'RO',
    'わ':'WA','を':'WO','が':'GA','ぎ':'GI','ぐ':'GU','げ':'GE','ご':'GO',
    'ざ':'ZA','じ':'JI','ず':'ZU','ぜ':'ZE','ぞ':'ZO',
    'だ':'DA','ぢ':'JI','づ':'ZU','で':'DE','ど':'DO',
    'ば':'BA','び':'BI','ぶ':'BU','べ':'BE','ぼ':'BO',
    'ぱ':'PA','ぴ':'PI','ぷ':'PU','ぺ':'PE','ぽ':'PO',
    'きゃ':'KYA','きゅ':'KYU','きょ':'KYO','しゃ':'SHA','しゅ':'SHU','しょ':'SHO',
    'ちゃ':'CHA','ちゅ':'CHU','ちょ':'CHO','にゃ':'NYA','にゅ':'NYU','にょ':'NYO',
    'ひゃ':'HYA','ひゅ':'HYU','ひょ':'HYO','みゃ':'MYA','みゅ':'MYU','みょ':'MYO',
    'りゃ':'RYA','りゅ':'RYU','りょ':'RYO','ぎゃ':'GYA','ぎゅ':'GYU','ぎょ':'GYO',
    'じゃ':'JA','じゅ':'JU','じょ':'JO','びゃ':'BYA','びゅ':'BYU','びょ':'BYO',
    'ぴゃ':'PYA','ぴゅ':'PYU','ぴょ':'PYO','ふぁ':'FA','ふぃ':'FI','ふぇ':'FE','ふぉ':'FO',
    'てぃ':'TI','でぃ':'DI','ぁ':'LA','ぃ':'LI','ぅ':'LU','ぇ':'LE','ぉ':'LO',
    'ゃ':'LYA','ゅ':'LYU','ょ':'LYO','ー':'-'
};

export const FINGER_MAP = {
    '1':'l-pinky','Q':'l-pinky','A':'l-pinky','Z':'l-pinky','2':'l-ring','W':'l-ring','S':'l-ring','X':'l-ring','3':'l-middle','E':'l-middle','D':'l-middle','C':'l-middle','4':'l-index','R':'l-index','F':'l-index','V':'l-index','5':'l-index','T':'l-index','G':'l-index','B':'l-index','6':'r-index','Y':'r-index','H':'r-index','N':'r-index','7':'r-index','U':'r-index','J':'r-index','M':'r-index','8':'r-middle','I':'r-middle','K':'r-middle',',':'r-middle','9':'r-ring','O':'r-ring','L':'r-ring','.':'r-ring','0':'r-pinky','P':'r-pinky',';':'r-pinky','/':'r-pinky','-':'r-pinky','@':'r-pinky',':':'r-pinky','^':'r-pinky','SPACE':'thumb'
};
export const FINGER_HOME_MAP = {'l-pinky':'A','l-ring':'S','l-middle':'D','l-index':'F','r-index':'J','r-middle':'K','r-ring':'L','r-pinky':';','thumb':'SPACE'};
export const COLOR_CLASS_MAP = {'thumb':'color-thumb','l-index':'color-index','r-index':'color-index','l-middle':'color-middle','r-middle':'color-middle','l-ring':'color-ring','r-ring':'color-ring','l-pinky':'color-pinky','r-pinky':'color-pinky'};

export const ALPHABET_READING_STAGES = [
    { id: 9001, title: 'ABC 1', keys: ['A', 'B', 'C', 'D', 'E', 'F'], sub: 'A〜Fを きいて おぼえる' },
    { id: 9002, title: 'ABC 2', keys: ['G', 'H', 'I', 'J', 'K', 'L'], sub: 'G〜Lを きいて おぼえる' },
    { id: 9003, title: 'ABC 3', keys: ['M', 'N', 'O', 'P', 'Q', 'R'], sub: 'M〜Rを きいて おぼえる' },
    { id: 9004, title: 'ABC 4', keys: ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], sub: 'S〜Zを きいて おぼえる' },
    { id: 9005, title: 'ABC まぜこぜ', keys: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'], sub: 'A〜Mを まぜて やってみる' },
    { id: 9006, title: 'ABC チャレンジ', keys: ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], sub: 'N〜Zを まぜて やってみる' }
];

export const ALPHABET_READING_NAMES = {
    A: 'エー',
    B: 'ビー',
    C: 'シー',
    D: 'ディー',
    E: 'イー',
    F: 'エフ',
    G: 'ジー',
    H: 'エイチ',
    I: 'アイ',
    J: 'ジェイ',
    K: 'ケー',
    L: 'エル',
    M: 'エム',
    N: 'エヌ',
    O: 'オー',
    P: 'ピー',
    Q: 'キュー',
    R: 'アール',
    S: 'エス',
    T: 'ティー',
    U: 'ユー',
    V: 'ブイ',
    W: 'ダブリュー',
    X: 'エックス',
    Y: 'ワイ',
    Z: 'ゼット'
};

export const KEYBOARD_STAGES =[
    {id:1001,keys:['F','J','SPACE'],title:'人差し指(ホーム)'},{id:1002,keys:['D','K','SPACE'],title:'中指(ホーム)'},{id:1003,keys:['S','L','SPACE'],title:'薬指(ホーム)'},{id:1004,keys:['A',';','SPACE'],title:'小指(ホーム)'},{id:1005,keys:['G','H','SPACE'],title:'人差し指(うち)'},
    {id:1006,keys:['R','U','SPACE'],title:'人差し指(うえ)'},{id:1007,keys:['E','I','SPACE'],title:'中指(うえ)'},{id:1008,keys:['W','O','SPACE'],title:'薬指(うえ)'},{id:1009,keys:['Q','P','SPACE'],title:'小指(うえ)'},{id:1010,keys:['T','Y','SPACE'],title:'人差し指(遠うえ)'},
    {id:1011,keys:['V','M','SPACE'],title:'人差し指(した)'},{id:1012,keys:['C',',','SPACE'],title:'中指(した)'},{id:1013,keys:['X','.','SPACE'],title:'薬指(した)'},{id:1014,keys:['Z','/','SPACE'],title:'小指(した)'},{id:1015,keys:['B','N','SPACE'],title:'人差し指(遠した)'},
    {id:1016,keys:['4','7','SPACE'],title:'人差し指(数)'},{id:1017,keys:['3','8','SPACE'],title:'中指(数)'},{id:1018,keys:['2','9','SPACE'],title:'薬指(数)'},{id:1019,keys:['1','0','SPACE'],title:'小指(数)'},{id:1020,keys:['5','6','-','SPACE'],title:'人差/小(遠数)'}
];
export const BLIND_STAGES =[
    {id:2001,title:'ホーム(練)',ref:'home',type:'practice'},{id:2101,title:'ホーム(試)',ref:'home',type:'exam'},
    {id:2002,title:'上段(練)',ref:'top',type:'practice'},{id:2102,title:'上段(試)',ref:'top',type:'exam'},
    {id:2003,title:'下段(練)',ref:'bottom',type:'practice'},{id:2103,title:'下段(試)',ref:'bottom',type:'exam'},
    {id:2004,title:'数字(練)',ref:'number',type:'practice'},{id:2104,title:'数字(試)',ref:'number',type:'exam'}
];
export const BRIDGE_STAGES =[
    {id:1051,title:'ホーム総復習',keys:[],refChapter:'home'},{id:1052,title:'上段総復習',keys:[],refChapter:'top'},{id:1053,title:'下段総復習',keys:[],refChapter:'bottom'},{id:1054,title:'数字総復習',keys:[],refChapter:'number'}
];
export const HIRAGANA_DATA =[
    {id:3001,title:'あ行',chars:[{h:'あ',r:['A']},{h:'い',r:['I']},{h:'う',r:['U']},{h:'え',r:['E']},{h:'お',r:['O']}]},
    {id:3002,title:'か行',chars:[{h:'か',r:['KA']},{h:'き',r:['KI']},{h:'く',r:['KU']},{h:'け',r:['KE']},{h:'こ',r:['KO']}]},
    {id:3003,title:'さ行',chars:[{h:'さ',r:['SA']},{h:'し',r:['SHI','SI']},{h:'す',r:['SU']},{h:'せ',r:['SE']},{h:'そ',r:['SO']}]},
    {id:3004,title:'た行',chars:[{h:'た',r:['TA']},{h:'ち',r:['CHI','TI']},{h:'つ',r:['TSU','TU']},{h:'て',r:['TE']},{h:'と',r:['TO']}]},
    {id:3005,title:'な行',chars:[{h:'な',r:['NA']},{h:'に',r:['NI']},{h:'ぬ',r:['NU']},{h:'ね',r:['NE']},{h:'の',r:['NO']}]},
    {id:3006,title:'は行',chars:[{h:'は',r:['HA']},{h:'ひ',r:['HI']},{h:'ふ',r:['FU','HU']},{h:'へ',r:['HE']},{h:'ほ',r:['HO']}]},
    {id:3007,title:'ま行',chars:[{h:'ま',r:['MA']},{h:'み',r:['MI']},{h:'む',r:['MU']},{h:'め',r:['ME']},{h:'も',r:['MO']}]},
    {id:3008,title:'や行',chars:[{h:'や',r:['YA']},{h:'ゆ',r:['YU']},{h:'よ',r:['YO']}]},
    {id:3009,title:'ら行',chars:[{h:'ら',r:['RA']},{h:'り',r:['RI']},{h:'る',r:['RU']},{h:'れ',r:['RE']},{h:'ろ',r:['RO']}]},
    {id:3010,title:'わ行',chars:[{h:'わ',r:['WA']},{h:'を',r:['WO']},{h:'ん',r:['NN']}]},
    {id:3011,title:'が行',chars:[{h:'が',r:['GA']},{h:'ぎ',r:['GI']},{h:'ぐ',r:['GU']},{h:'げ',r:['GE']},{h:'ご',r:['GO']}]},
    {id:3012,title:'ざ行',chars:[{h:'ざ',r:['ZA']},{h:'じ',r:['JI','ZI']},{h:'ず',r:['ZU']},{h:'ぜ',r:['ZE']},{h:'ぞ',r:['ZO']}]},
    {id:3013,title:'だ行',chars:[{h:'だ',r:['DA']},{h:'ぢ',r:['DI','JI']},{h:'づ',r:['DU','ZU']},{h:'で',r:['DE']},{h:'ど',r:['DO']}]},
    {id:3014,title:'ば行',chars:[{h:'ば',r:['BA']},{h:'び',r:['BI']},{h:'ぶ',r:['BU']},{h:'べ',r:['BE']},{h:'ぼ',r:['BO']}]},
    {id:3015,title:'ぱ行',chars:[{h:'ぱ',r:['PA']},{h:'ぴ',r:['PI']},{h:'ぷ',r:['PU']},{h:'ぺ',r:['PE']},{h:'ぽ',r:['PO']}]}
];

export const ADVICE_HINT_MAP = {
    'F':1001,'J':1001,'D':1002,'K':1002,'S':1003,'L':1003,'A':1004,';':1004,'G':1005,'H':1005,
    'R':1006,'U':1006,'E':1007,'I':1007,'W':1008,'O':1008,'Q':1009,'P':1009,'T':1010,'Y':1010,
    'V':1011,'M':1011,'C':1012,',':1012,'X':1013,'.':1013,'Z':1014,'/':1014,'B':1015,'N':1015,
    '4':1016,'7':1016,'3':1017,'8':1017,'2':1018,'9':1018,'1':1019,'0':1019,'5':1020,'6':1020,'-':1020
};

export const WORD_DATA =[
    { id: 4001, title: 'どうぶつ', chars:[{h:'いぬ', r:['INU']}, {h:'ねこ', r:['NEKO']}, {h:'くま', r:['KUMA']}, {h:'うさぎ', r:['USAGI']}, {h:'さる', r:['SARU']}, {h:'きりん', r:['KIRINN']}, {h:'ぞう', r:['ZOU']}, {h:'らいおん', r:['RAIONN']}]},
    { id: 4002, title: 'たべもの', chars:[{h:'りんご', r:['RINGO', 'RINNGO']}, {h:'みかん', r:['MIKANN']}, {h:'いちご', r:['ITIGO', 'ICHIGO']}, {h:'すいか', r:['SUIKA']}, {h:'ぶどう', r:['BUDOU']}, {h:'ばなな', r:['BANANA']}, {h:'めろん', r:['MERONN']}]},
    { id: 4003, title: 'のりもの', chars:[{h:'くるま', r:['KURUMA']}, {h:'でんしゃ', r:['DENSHA','DENSYA','DENNSHA','DENNSYA']}, {h:'ひこうき', r:['HIKOUKI']}, {h:'ふね', r:['HUNE', 'FUNE']}, {h:'じてんしゃ', r:['ZITENSHA','JITENSHA','ZITENSYA','JITENSYA','ZITENNSHA','JITENNSHA','ZITENNSYA','JITENNSYA','ZITENSIXYA','JITENSIXYA','ZITENSILYA','JITENSILYA','ZITENSHIXYA','JITENSHIXYA','ZITENSHILYA','JITENSHILYA']}, {h:'ばす', r:['BASU']}]},
    { id: 4004, title: 'がっこう', chars:[{h:'つくえ', r:['TUKUE', 'TSUKUE']}, {h:'いす', r:['ISU']}, {h:'えんぴつ', r:['ENPITU', 'ENPITSU', 'ENNPITU', 'ENNPITSU']}, {h:'けしごむ', r:['KESIGOMU', 'KESHIGOMU']}, {h:'はさみ', r:['HASAMI']}, {h:'せんせい', r:['SENSEI', 'SENNSEI']}]},
    { id: 4005, title: '「ん」のれんしゅう', chars:[{h:'しんぶん', r:['SINBUNN', 'SHINBUNN', 'SINNBUNN', 'SHINNBUNN']},{h:'みんな', r:['MINNNA']}, {h:'にんじん', r:['NINZINN', 'NINJINN', 'NINNZINN', 'NINNJINN']},{h:'てんき', r:['TENKI', 'TENNKI']},{h:'こんにゃく', r:['KONNNYAKU']}]},
    { id: 4006, title: '「っ」のれんしゅう', chars:[{h:'がっこう', r:['GAKKOU', 'GALTUKOU', 'GAXTUKOU', 'GALTSUKOU', 'GAXTSUKOU']},{h:'きっぷ', r:['KIPPU', 'KILTUPU', 'KIXTUPU']},{h:'らっぱ', r:['RAPPA', 'RALTUPA', 'RAXTUPA']},{h:'きって', r:['KITTE', 'KILTUTE', 'KIXTUTE']},{h:'ざっし', r:['ZASSI', 'ZASSHI', 'ZALTUSI', 'ZAXTUSI', 'ZALTUSHI', 'ZAXTUSHI']}]},
    { id: 4007, title: '「ゃ・ゅ・ょ」', chars:[{h:'きんぎょ', r:['KINGYO', 'KINNGYO']},{h:'じどうしゃ', r:['ZIDOUSHA','JIDOUSHA','ZIDOUSYA','JIDOUSYA']},{h:'きゅうり', r:['KYUURI']},{h:'ひゃく', r:['HYAKU']},{h:'きょうりゅう', r:['KYOURYUU','KYOURYUXYUU','KYOURYULYUU']}]},
    { id: 4008, title: '「ー」ばすおと', chars:[{h:'けーき', r:['KE-KI']},{h:'すーぱー', r:['SU-PA-']},{h:'こーひー', r:['KO-HI-']},{h:'すぽーつ', r:['SUPO-TU', 'SUPO-TSU']},{h:'のーと', r:['NO-TO']}]},
    { id: 4009, title: 'とどうふけん', chars:[{h:'ほっかいどう', r:['HOKKAIDOU', 'HOLTUKAIDOU']},{h:'とうきょう', r:['TOUKYOU']},{h:'おおさか', r:['OOSAKA']},{h:'ふくおか', r:['HUKUOKA', 'FUKUOKA']},{h:'おきなわ', r:['OKINAWA']}]},
    { id: 4010, title: 'えいたんご', chars:[{h:'ＡＰＰＬＥ(りんご)', r:['APPLE']},{h:'ＢＯＯＫ(ほん)', r:['BOOK']},{h:'ＤＯＧ(いぬ)', r:['DOG']},{h:'ＣＡＴ(ねこ)', r:['CAT']},{h:'ＰＬＡＹ(あそぶ)', r:['PLAY']}]},
    { id: 4011, title: 'みじかいことば', chars:[{h:'あさ', r:['ASA']},{h:'いえ', r:['IE']},{h:'くつ', r:['KUTU','KUTSU']},{h:'そら', r:['SORA']},{h:'はな', r:['HANA']},{h:'やま', r:['YAMA']},{h:'かさ', r:['KASA']},{h:'みず', r:['MIZU']}]},
    { id: 4012, title: 'くらしのことば', chars:[{h:'そうじ', r:['SOUJI','SOUZI']},{h:'とけい', r:['TOKEI']},{h:'でんわ', r:['DENWA','DENNWA']},{h:'てがみ', r:['TEGAMI']},{h:'かいもの', r:['KAIMONO']},{h:'しゅくだい', r:['SHUKUDAI','SYUKUDAI']},{h:'おべんとう', r:['OBENTOU','OBENTOO','OBENNTOU','OBENNTOO']}]},
    { id: 4013, title: 'うごきのことば', chars:[{h:'あるく', r:['ARUKU']},{h:'はしる', r:['HASHIRU','HASIRU']},{h:'よむ', r:['YOMU']},{h:'かく', r:['KAKU']},{h:'はこぶ', r:['HAKOBU']},{h:'ならぶ', r:['NARABU']},{h:'あそぶ', r:['ASOBU']}]},
    { id: 4014, title: 'くとうてん', chars:[{h:'おはよう、せんせい', r:['OHAYOU,SENSEI','OHAYOU,SENNSEI']},{h:'きょうは、はれです', r:['KYOUHA,HAREDESU']},{h:'まず、てをあらう', r:['MAZU,TEWOARAU']},{h:'つぎに、じゅんびする', r:['TUGINI,JUNBISURU','TUGINI,ZYUNBISURU','TSUGINI,JUNBISURU','TSUGINI,ZYUNBISURU']}]},
    { id: 4015, title: 'ながいことば', chars:[{h:'あさのじゅんび', r:['ASANOJUNBI','ASANOZYUNBI']},{h:'きょうしつそうじ', r:['KYOUSHITUSOUJI','KYOUSITUSOUZI']},{h:'れんしゅうもんだい', r:['RENSHUUMONDAI','RENSYUUMONDAI','RENNSHUUMONNDAI','RENNSYUUMONNDAI']},{h:'やさしいきもち', r:['YASASHIIKIMOCHI','YASASIIKIMOTI']}]},
    { id: 4016, title: 'カタカナことば', chars:[{h:'ゲーム', r:['GE-MU']},{h:'パソコン', r:['PASOKONN']},{h:'メール', r:['ME-RU']},{h:'キーボード', r:['KI-BO-DO']},{h:'マウス', r:['MAUSU']},{h:'プリント', r:['PURINTO','PURINNTO']}]},
    { id: 4017, title: 'みじかい文', chars:[{h:'あさ、てをあらう', r:['ASA,TEWOARAU']},{h:'きょう、ほんをよむ', r:['KYOU,HONNWOYOMU']},{h:'つぎ、じゅんびする', r:['TUGI,JUNNBISURU','TSUGI,JUNNBISURU','TUGI,ZYUNNBISURU','TSUGI,ZYUNNBISURU']},{h:'みんな、ならぶ', r:['MINNNA,NARABU']},{h:'まず、なまえをかく', r:['MAZU,NAMAEWOKAKU']}]},
    { id: 4018, title: '教室の文', chars:[{h:'せんせい、できました', r:['SENSEI,DEKIMASITA','SENNSEI,DEKIMASITA','SENSEI,DEKIMASHITA','SENNSEI,DEKIMASHITA']},{h:'きょうしつ、そうじします', r:['KYOUSITU,SOUJISIMASU','KYOUSHITU,SOUJISHIMASU','KYOUSITSU,SOUJISHIMASU']},{h:'プリント、くばります', r:['PURINTO,KUBARIMASU','PURINNTO,KUBARIMASU']},{h:'チャイム、なりました', r:['CHAIMU,NARIMASITA','CHAIMU,NARIMASHITA','TYAIMU,NARIMASITA','TYAIMU,NARIMASHITA']}]},
    { id: 4019, title: 'パソコンの文', chars:[{h:'マウス、うごかします', r:['MAUSU,UGOKASIMASU','MAUSU,UGOKASHIMASU']},{h:'キーを、ゆっくりおす', r:['KI-WO,YUKKURIOSU']},{h:'もじを、なおします', r:['MOJIWO,NAOSIMASU','MOZIWO,NAOSIMASU','MOJIWO,NAOSHIMASU','MOZIWO,NAOSHIMASU']},{h:'ファイル、ひらきます', r:['FAIRU,HIRAKIMASU']}]},
    { id: 4020, title: '生活の文', chars:[{h:'あいさつ、だいじです', r:['AISATU,DAIJIDESU','AISATSU,DAIJIDESU']},{h:'みずを、のみます', r:['MIZUWO,NOMIMASU']},{h:'ていねいに、かきます', r:['TEINEINI,KAKIMASU']},{h:'やさしく、はなします', r:['YASASIKU,HANASIMASU','YASASHIKU,HANASHIMASU','YASASIKU,HANASHIMASU','YASASHIKU,HANASIMASU']}]},
    { id: 4021, title: 'ていねいな文', chars:[{h:'よろしく、おねがいします', r:['YOROSIKU,ONEGAISIMASU','YOROSHIKU,ONEGAISHIMASU','YOROSHIKU,ONEGAISIMASU','YOROSIKU,ONEGAISHIMASU']},{h:'ありがとうございます', r:['ARIGATOUGOZAIMASU']},{h:'もういちど、おねがいします', r:['MOUITIDO,ONEGAISIMASU','MOUICHIDO,ONEGAISHIMASU','MOUICHIDO,ONEGAISIMASU','MOUITIDO,ONEGAISHIMASU']},{h:'ゆっくり、かくにんします', r:['YUKKURI,KAKUNINNSIMASU','YUKKURI,KAKUNINNSHIMASU']}]},
    { id: 4022, title: '操作の文', chars:[{h:'クリックして、ひらきます', r:['KURIKKUSITE,HIRAKIMASU','KURIKKUSHITE,HIRAKIMASU']},{h:'ドラッグして、うごかします', r:['DORAGGUSITE,UGOKASIMASU','DORAGGUSHITE,UGOKASHIMASU','DORAGGUSITE,UGOKASHIMASU','DORAGGUSHITE,UGOKASIMASU']},{h:'ファイルを、ほぞんします', r:['FAIRUWO,HOZONNSIMASU','FAIRUWO,HOZONNSHIMASU']},{h:'パスワードを、いれます', r:['PASUWA-DOWO,IREMASU']}]},
    { id: 4023, title: '連絡の文', chars:[{h:'あした、プリントをもってくる', r:['ASITA,PURINTOWOMOTTEKURU','ASHITA,PURINNTOWOMOTTEKURU','ASHITA,PURINTOWOMOTTEKURU','ASITA,PURINNTOWOMOTTEKURU']},{h:'きょうは、れんしゅうします', r:['KYOUHA,RENNSYUUSIMASU','KYOUHA,RENNSHUUSHIMASU','KYOUHA,RENNSYUUSHIMASU','KYOUHA,RENNSHUUSIMASU']},{h:'つぎに、なまえをかきます', r:['TUGINI,NAMAEWOKAKIMASU','TSUGINI,NAMAEWOKAKIMASU']},{h:'おわったら、ほうこくします', r:['OWATTARA,HOUKOKUSIMASU','OWATTARA,HOUKOKUSHIMASU']}]},
    { id: 4024, title: '記号の入力', chars:[{h:'A-1', r:['A-1']},{h:'B-2', r:['B-2']},{h:'1/2', r:['1/2']},{h:'3/4', r:['3/4']},{h:'A,B,C', r:['A,B,C']},{h:'NO.1', r:['NO.1']}]},
    { id: 4025, title: '日付と番号', chars:[{h:'2026/05/15', r:['2026/05/15']},{h:'05/15', r:['05/15']},{h:'1-2-3', r:['1-2-3']},{h:'D-LESSON', r:['D-LESSON']},{h:'PAGE.10', r:['PAGE.10']}]},
    { id: 4026, title: '実用メモ', chars:[{h:'ファイル1', r:['FAIRU1']},{h:'プリント2', r:['PURINTO2','PURINNTO2']},{h:'れんしゅう3', r:['RENNSHUU3','RENNSYUU3']},{h:'ページ4', r:['PE-JI4','PE-ZI4']},{h:'メモA-1', r:['MEMOA-1']}]},
    { id: 4027, title: '番号入りの文', chars:[{h:'1ばんを、えらびます', r:['1BANNWO,ERABIMASU']},{h:'2ページを、ひらきます', r:['2PE-JIWO,HIRAKIMASU','2PE-ZIWO,HIRAKIMASU']},{h:'3こ、できました', r:['3KO,DEKIMASITA','3KO,DEKIMASHITA']},{h:'4ばんに、すすみます', r:['4BANNNI,SUSUMIMASU']}]},
    { id: 4028, title: '記号入りの文', chars:[{h:'A-1を、みます', r:['A-1WO,MIMASU']},{h:'B-2を、なおします', r:['B-2WO,NAOSIMASU','B-2WO,NAOSHIMASU']},{h:'1/2まで、できました', r:['1/2MADE,DEKIMASITA','1/2MADE,DEKIMASHITA']},{h:'NO.1を、えらびます', r:['NO.1WO,ERABIMASU']}]},
    { id: 4029, title: '報告の文', chars:[{h:'きょうは、3こできました。', r:['KYOUHA,3KODEKIMASITA.','KYOUHA,3KODEKIMASHITA.']},{h:'プリント2を、ひらきます。', r:['PURINTO2WO,HIRAKIMASU.','PURINNTO2WO,HIRAKIMASU.']},{h:'A-1まで、おわりました。', r:['A-1MADE,OWARIMASITA.','A-1MADE,OWARIMASHITA.']},{h:'ページ4を、かくにんします。', r:['PE-JI4WO,KAKUNINNSIMASU.','PE-ZI4WO,KAKUNINNSIMASU.']}]},
    { id: 4030, title: '読点で区切る文', chars:[{h:'まず、1ばんを見ます。', r:['MAZU,1BANNWOMIMASU.']},{h:'つぎに、名前を書きます。', r:['TUGINI,NAMAEWOKAKIMASU.','TSUGINI,NAMAEWOKAKIMASU.']},{h:'さいごに、保存します。', r:['SAIGONI,HOZONNSIMASU.','SAIGONI,HOZONNSHIMASU.']},{h:'ゆっくり、確認します。', r:['YUKKURI,KAKUNINNSIMASU.','YUKKURI,KAKUNINNSHIMASU.']}]},
    { id: 4031, title: '二つの文', chars:[{h:'ファイルを開きます。名前を見ます。', r:['FAIRUWOHIRAKIMASU.NAMAEWOMIMASU.']},{h:'1ばんを選びます。つぎへ進みます。', r:['1BANNWOERABIMASU.TUGIHESUSUMIMASU.','1BANNWOERABIMASU.TSUGIHESUSUMIMASU.']},{h:'まちがいを直します。もう一度見ます。', r:['MATIGAIWONAOSIMASU.MOUITIDOMIMASU.','MACHIGAIWONAOSHIMASU.MOUICHIDOMIMASU.','MACHIGAIWONAOSIMASU.MOUICHIDOMIMASU.']},{h:'できたら、先生に知らせます。', r:['DEKITARA,SENSEINISIRASEMASU.','DEKITARA,SENNSEINISIRASEMASU.','DEKITARA,SENSEINISHIRASEMASU.','DEKITARA,SENNSEINISHIRASEMASU.']}]},
    { id: 4032, title: '短い説明文', chars:[{h:'上のボタンを押します。', r:['UENOBOTANNWOOSIMASU.','UENOBOTANNWOOSHIMASU.']},{h:'青いカードを選びます。', r:['AOIKA-DOWOERABIMASU.']},{h:'まちがえたら、やり直します。', r:['MATIGAETARA,YARINAOSIMASU.','MACHIGAETARA,YARINAOSHIMASU.','MACHIGAETARA,YARINAOSIMASU.']},{h:'終わったら、もどります。', r:['OWATTARA,MODORIMASU.']}]}
];

export const EXAMS =[
    {id:1101, title:'ホーム試験', gold: 30, silver: 45},{id:1102, title:'上段試験', gold: 35, silver: 50},{id:1103, title:'下段試験', gold: 35, silver: 50},{id:1104, title:'数字試験', gold: 40, silver: 60},
    {id:3301, title:'あ～さ試験', gold: 40, silver: 60},{id:3302, title:'た～は試験', gold: 40, silver: 60},{id:3303, title:'ま～ん試験', gold: 50, silver: 70},{id:3304, title:'濁点試験', gold: 70, silver: 100},
    {id:4101, title:'ことばまとめ(基本)', gold: 60, silver: 90},{id:4102, title:'ことばまとめ(特殊)', gold: 60, silver: 90},{id:4103, title:'ことばまとめ(レベルアップ)', gold: 60, silver: 90},
    {id:4104, title:'ことばまとめ(実用)', gold: 70, silver: 100},{id:4105, title:'ことばまとめ(文)', gold: 80, silver: 120},{id:4106, title:'ことばまとめ(短文)', gold: 90, silver: 130},{id:4107, title:'ことばまとめ(実践文)', gold: 100, silver: 140},{id:4108, title:'ことばまとめ(記号)', gold: 110, silver: 150},{id:4109, title:'ことばまとめ(実用文)', gold: 120, silver: 160},{id:4110, title:'ことばまとめ(文章準備)', gold: 130, silver: 170},
    {id:1999, title:'総合試験(きほん)', gold: 100, silver: 150},
    {id:2999, title:'総合試験(ブラインド)', gold: 120, silver: 180},
    {id:3999, title:'総合試験(ひらがな)', gold: 150, silver: 200},
    {id:4999, title:'総合試験(ことば)', gold: 150, silver: 200}
];

export const STAGE_ORDER =[
    1001,1002,1003,1004,1005, 1051, 1101, 1006,1007,1008,1009,1010, 1052, 1102, 1011,1012,1013,1014,1015, 1053, 1103, 1016,1017,1018,1019,1020, 1054, 1104, 1999,
    2001,2101,2002,2102,2003,2103,2004,2104, 2999,
    3001,3101,3201,3002,3102,3202,3003,3103,3203,3301, 3004,3104,3204,3005,3105,3205,3006,3106,3206,3302,
    3007,3107,3207,3008,3108,3208,3009,3109,3209,3010,3110,3210,3303, 3011,3111,3211,3012,3112,3212,3013,3113,3213,3014,3114,3214,3015,3115,3215,3304, 3999,
    4001,4002,4003,4004,4101, 4005,4006,4007,4008,4102, 4009,4010,4103, 4999, 4011,4012,4013,4104, 4014,4015,4016,4105, 4017,4018,4019,4020,4106, 4021,4022,4023,4107, 4024,4025,4026,4108, 4027,4028,4029,4109, 4030,4031,4032,4110
];

export const KB_CHAPTERS =[
    {id:'alphabet',title:'ABCをおぼえる',stages:[9001,9002,9003,9004,9005,9006],bridge:null,exam:null},
    {id:'home',title:'ホームポジション編',stages:[1001,1002,1003,1004,1005],bridge:1051,exam:1101},
    {id:'top',title:'上の段編',stages:[1006,1007,1008,1009,1010],bridge:1052,exam:1102},
    {id:'bottom',title:'下の段編',stages:[1011,1012,1013,1014,1015],bridge:1053,exam:1103},
    {id:'number',title:'数字の段編',stages:[1016,1017,1018,1019,1020],bridge:1054,exam:1104},
    {id:'blind',title:'ブラインドタッチ',stages:[2001,2101,2002,2102,2003,2103,2004,2104],bridge:null,exam:null},
    {id:'h_1',title:'ひらがな(あ〜さ)',stages:[3001,3101,3201,3002,3102,3202,3003,3103,3203],bridge:null,exam:3301},
    {id:'h_2',title:'ひらがな(た〜は)',stages:[3004,3104,3204,3005,3105,3205,3006,3106,3206],bridge:null,exam:3302},
    {id:'h_3',title:'ひらがな(ま〜ん)',stages:[3007,3107,3207,3008,3108,3208,3009,3109,3209,3010,3110,3210],bridge:null,exam:3303},
    {id:'h_4',title:'ひらがな(濁点)',stages:[3011,3111,3211,3012,3112,3212,3013,3113,3213,3014,3114,3214,3015,3115,3215],bridge:null,exam:3304},
    {id:'word1',title:'ことばのれんしゅう(きほん)',stages:[4001,4002,4003,4004],bridge:null,exam:4101}, 
    {id:'word2',title:'ことばのれんしゅう(とくしゅ)',stages:[4005,4006,4007,4008],bridge:null,exam:4102},
    {id:'word3',title:'ことばのれんしゅう(レベルアップ)',stages:[4009,4010],bridge:null,exam:4103},
    {id:'word4',title:'ことばのれんしゅう(実用)',stages:[4011,4012,4013],bridge:null,exam:4104},
    {id:'word5',title:'ことばのれんしゅう(文・カタカナ)',stages:[4014,4015,4016],bridge:null,exam:4105},
    {id:'word6',title:'ことばのれんしゅう(短文)',stages:[4017,4018,4019,4020],bridge:null,exam:4106},
    {id:'word7',title:'ことばのれんしゅう(実践)',stages:[4021,4022,4023],bridge:null,exam:4107},
    {id:'word8',title:'ことばのれんしゅう(記号)',stages:[4024,4025,4026],bridge:null,exam:4108},
    {id:'word9',title:'ことばのれんしゅう(実用文)',stages:[4027,4028,4029],bridge:null,exam:4109},
    {id:'word10',title:'ことばのれんしゅう(文章準備)',stages:[4030,4031,4032],bridge:null,exam:4110}
];

export const KB_LAYOUT = [['1','2','3','4','5','6','7','8','9','0','-'],['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L',';'],['Z','X','C','V','B','N','M',',','.','/'],['SPACE']];

export const WORD_STAGES =[
    // --- 初級1 ---
    { id: 'w_b1_1', title: '初級1: 第1章', sub: 'Wordの基本操作', pdf: 'https://drive.google.com/file/d/1-FqZ40jUKyyBt3HT2rGAfYVgV8htaqHi/view?usp=drive_link' },
    { id: 'w_b1_2', title: '初級1: 第2章', sub: '文書を入力しましょう', pdf: 'https://drive.google.com/file/d/1PNhSTRREzR0DOk-ka8-zIpSzOWxDtSko/view?usp=drive_link' },
    { id: 'w_b1_3', title: '初級1: 第3章', sub: '『潮干狩りの案内』を作る', pdf: 'https://drive.google.com/file/d/1SQrbBR2dfIg1e5QpJGuyLH4ehAIz184X/view?usp=drive_link' },
    { id: 'w_b1_4', title: '初級1: 第4章', sub: '表の作成', pdf: 'https://drive.google.com/file/d/1S72do7S7pP0mtxaADaaLC2iLUiy8MKV0/view?usp=drive_link' },
    { id: 'w_b1_5', title: '初級1: 第5章', sub: '総合問題', pdf: 'https://drive.google.com/file/d/1dfuPSPAku_ixixSNU5FHCE3IK8vNwpPb/view?usp=drive_link' },
    // --- 中級4 ---
    // ※他の級や章を追加する場合は、ここにコピーして増やしてください
    { id: 'w_m4_1', title: '中級4: 第1章', sub: '図形を自由に加工する', pdf: 'https://drive.google.com/file/d/18mNWptnEPEI1tAffHsKfMpoYivD0nrkZ/view?usp=drive_link' },
    { id: 'w_m4_2', title: '中級4: 第2章', sub: 'パイプの老人のイラストを描く', pdf: 'https://drive.google.com/file/d/1FC_zSLHj-oB78huF3sw2QGsHhCkr0wpZ/view?usp=drive_link' },
    { id: 'w_m4_3', title: '中級4: 第3章', sub: '総合問題', pdf: 'https://drive.google.com/file/d/1_cktFg6o3rNPrSsGB-YyUSubAu4khlht/view?usp=drive_link' }
];

export const ROMAJI_TABLE_DATA = {
    'romaji_basic': {
        rows: [[{h:'あ',r:['A']},{h:'い',r:['I']},{h:'う',r:['U']},{h:'え',r:['E']},{h:'お',r:['O']}],[{h:'か',r:['KA']},{h:'き',r:['KI']},{h:'く',r:['KU']},{h:'け',r:['KE']},{h:'こ',r:['KO']}],[{h:'さ',r:['SA']},{h:'し',r:['SHI','SI']},{h:'す',r:['SU']},{h:'せ',r:['SE']},{h:'そ',r:['SO']}],[{h:'た',r:['TA']},{h:'ち',r:['CHI','TI']},{h:'つ',r:['TSU','TU']},{h:'て',r:['TE']},{h:'と',r:['TO']}],[{h:'な',r:['NA']},{h:'に',r:['NI']},{h:'ぬ',r:['NU']},{h:'ね',r:['NE']},{h:'の',r:['NO']}],[{h:'は',r:['HA']},{h:'ひ',r:['HI']},{h:'ふ',r:['FU','HU']},{h:'へ',r:['HE']},{h:'ほ',r:['HO']}],[{h:'ま',r:['MA']},{h:'み',r:['MI']},{h:'む',r:['MU']},{h:'め',r:['ME']},{h:'も',r:['MO']}],[{h:'や',r:['YA']},null,{h:'ゆ',r:['YU']},null,{h:'よ',r:['YO']}],[{h:'ら',r:['RA']},{h:'り',r:['RI']},{h:'る',r:['RU']},{h:'れ',r:['RE']},{h:'ろ',r:['RO']}],[{h:'わ',r:['WA']},null,null,null,{h:'を',r:['WO']}],[{h:'ん',r:['NN']},null,null,null,null]
        ]
    },
    'romaji_daku': {
        rows: [
            [{h:'が',r:['GA']},{h:'ぎ',r:['GI']},{h:'ぐ',r:['GU']},{h:'げ',r:['GE']},{h:'ご',r:['GO']}],[{h:'ざ',r:['ZA']},{h:'じ',r:['JI','ZI']},{h:'ず',r:['ZU']},{h:'ぜ',r:['ZE']},{h:'ぞ',r:['ZO']}],[{h:'だ',r:['DA']},{h:'ぢ',r:['DI']},{h:'づ',r:['DU']},{h:'で',r:['DE']},{h:'ど',r:['DO']}],[{h:'ば',r:['BA']},{h:'び',r:['BI']},{h:'ぶ',r:['BU']},{h:'べ',r:['BE']},{h:'ぼ',r:['BO']}],[{h:'ぱ',r:['PA']},{h:'ぴ',r:['PI']},{h:'ぷ',r:['PU']},{h:'ぺ',r:['PE']},{h:'ぽ',r:['PO']}],
            [{h:'きゃ',r:['KYA']},{h:'きゅ',r:['KYU']},{h:'きょ',r:['KYO']},null,null],[{h:'しゃ',r:['SHA','SYA']},{h:'しゅ',r:['SHU','SYU']},{h:'しょ',r:['SHO','SYO']},null,null],
            [{h:'ちゃ',r:['CHA','TYA']},{h:'ちゅ',r:['CHU','TYU']},{h:'ちょ',r:['CHO','TYO']},null,null],
            // ★追加: 拗音・促音[{h:'にゃ',r:['NYA']},{h:'にゅ',r:['NYU']},{h:'にょ',r:['NYO']},null,null],
            [{h:'ひゃ',r:['HYA']},{h:'ひゅ',r:['HYU']},{h:'ひょ',r:['HYO']},null,null],
            [{h:'ふぁ',r:['FA']},{h:'ふぃ',r:['FI']},{h:'ふぇ',r:['FE']},{h:'ふぉ',r:['FO']},null],[{h:'みゃ',r:['MYA']},{h:'みゅ',r:['MYU']},{h:'みょ',r:['MYO']},null,null],
            [{h:'りゃ',r:['RYA']},{h:'りゅ',r:['RYU']},{h:'りょ',r:['RYO']},null,null],
            [{h:'っか',r:['KKA','LTUKA','XTUKA']},{h:'っさ',r:['SSA','LTUSA','XTUSA']},{h:'った',r:['TTA','LTUTA','XTUTA']},{h:'っは',r:['HHA','LTUHA','XTUHA']},{h:'っま',r:['MMA','LTUMA','XTUMA']}],
            [{h:'っや',r:['YYA','LTUYA','XTUYA']},{h:'っら',r:['RRA','LTURA','XTURA']},{h:'っわ',r:['WWA','LTUWA','XTUWA']},null,null]
        ]
    }
};

HIRAGANA_DATA.forEach(d=>{d.chars.forEach(c=>{ADVICE_HINT_MAP[c.h]=d.id;})});

export const THEMES =[
    { id: 'default', name: 'いつもの', icon: '🏠', isDynamic: false },
    { id: 'ocean', name: 'うみのそこ', icon: '🌊', bg: '#e1f5fe', text: '#01579b', btnBg: '#0288d1', btnText: '#fff' },
    { id: 'magic', name: 'まほうのしろ', icon: '🏰', bg: '#f3e5f5', text: '#6a1b9a', btnBg: '#8e24aa', btnText: '#fff' },
    { id: 'space', name: 'うちゅう', icon: '🚀', bg: '#1c2541', text: '#66fcf1', btnBg: '#45a29e', btnText: '#1c2541' },
    { id: 'ninja', name: 'にんじゃ', icon: '🥷', bg: '#212121', text: '#f5f5f5', btnBg: '#616161', btnText: '#fff' },
    { id: 'sakura', name: 'さくら', icon: '🌸', bg: '#fce4ec', text: '#d81b60', btnBg: '#ec407a', btnText: '#fff' },
    { id: 'night', name: 'よるのまち', icon: '🌃', bg: '#1a237e', text: '#ffeb3b', btnBg: '#3f51b5', btnText: '#fff' },
    { id: 'spring', name: 'はるののはら', icon: '🌷', bg: '#f1f8e9', text: '#33691e', btnBg: '#8bc34a', btnText: '#fff' },
    { id: 'sunflower', name: 'ひまわりばたけ', icon: '🌻', bg: '#fffde7', text: '#f57f17', btnBg: '#fbc02d', btnText: '#fff' },
    { id: 'autumn', name: 'あきのこうよう', icon: '🍁', bg: '#fff3e0', text: '#bf360c', btnBg: '#ff5722', btnText: '#fff' },
    { id: 'ice', name: 'こおりのしろ', icon: '❄️', bg: '#e0f7fa', text: '#006064', btnBg: '#00bcd4', btnText: '#fff' },
    { id: 'volcano', name: 'しゃくねつかざん', icon: '🔥', bg: '#ffebee', text: '#b71c1c', btnBg: '#f44336', btnText: '#fff' },
    { id: 'forest', name: 'ふかいもり', icon: '🌲', bg: '#e8f5e9', text: '#1b5e20', btnBg: '#4caf50', btnText: '#fff' },
    { id: 'desert', name: 'さばくのオアシス', icon: '🌴', bg: '#fff8e1', text: '#ff6f00', btnBg: '#ffc107', btnText: '#fff' },
    { id: 'thunder', name: 'かみなりぐも', icon: '⚡', bg: '#eceff1', text: '#263238', btnBg: '#607d8b', btnText: '#fff' },
    { id: 'rainbow', name: 'にじのそら', icon: '🌈', bg: '#f3e5f5', text: '#4a148c', btnBg: '#9c27b0', btnText: '#fff' },
    { id: 'sunset', name: 'ゆうやけ', icon: '🌇', bg: '#fbe9e7', text: '#d84315', btnBg: '#ff7043', btnText: '#fff' },
    { id: 'beach', name: 'トロピカルビーチ', icon: '🏖️', bg: '#e0f2f1', text: '#004d40', btnBg: '#26a69a', btnText: '#fff' },
    { id: 'cave', name: 'どうくつたんけん', icon: '🦇', bg: '#3e2723', text: '#d7ccc8', btnBg: '#795548', btnText: '#fff' },
    { id: 'savanna', name: 'サバンナ', icon: '🦁', bg: '#fff8e1', text: '#e65100', btnBg: '#ff9800', btnText: '#fff' },
    { id: 'penguin', name: 'ペンギンこおりやま', icon: '🐧', bg: '#e1f5fe', text: '#01579b', btnBg: '#03a9f4', btnText: '#fff' },
    { id: 'dino', name: 'きょうりゅうじだい', icon: '🦖', bg: '#f0f4c3', text: '#827717', btnBg: '#afb42b', btnText: '#fff' },
    { id: 'insect', name: 'むしとり', icon: '🦋', bg: '#f9fbe7', text: '#33691e', btnBg: '#c0ca33', btnText: '#fff' },
    { id: 'deepsea', name: 'しんかい', icon: '🦑', bg: '#000051', text: '#80d8ff', btnBg: '#00b0ff', btnText: '#fff' },
    { id: 'jungle', name: 'ジャングル', icon: '🐅', bg: '#1b5e20', text: '#c8e6c9', btnBg: '#388e3c', btnText: '#fff' },
    { id: 'nebula', name: 'うちゅうのせいうん', icon: '🌌', bg: '#12005e', text: '#ea80fc', btnBg: '#651fff', btnText: '#fff' },
    { id: 'frog', name: 'カエルのいけ', icon: '🐸', bg: '#e0f2f1', text: '#00695c', btnBg: '#00897b', btnText: '#fff' },
    { id: 'crystal', name: 'クリスタル', icon: '💎', bg: '#eef7ff', text: '#0d47a1', btnBg: '#42a5f5', btnText: '#fff' },
    { id: 'candy', name: 'キャンディ', icon: '🍬', bg: '#fff0f6', text: '#ad1457', btnBg: '#ec407a', btnText: '#fff' },
    { id: 'festival', name: 'おまつり', icon: '🏮', bg: '#fff8e1', text: '#bf360c', btnBg: '#ff8f00', btnText: '#fff' },
    { id: 'classroom', name: 'きょうしつ', icon: '📘', bg: '#f5f7fb', text: '#1e3a8a', btnBg: '#2563eb', btnText: '#fff' },
    { id: 'library', name: 'としょしつ', icon: '📚', bg: '#f3e5d0', text: '#4e342e', btnBg: '#8d6e63', btnText: '#fff' },
    { id: 'music', name: 'おんがくしつ', icon: '🎵', bg: '#f3e5f5', text: '#4a148c', btnBg: '#ab47bc', btnText: '#fff' },
    { id: 'sports', name: 'うんどうじょう', icon: '🏅', bg: '#e8f5e9', text: '#1b5e20', btnBg: '#43a047', btnText: '#fff' },
    { id: 'workshop', name: 'こうさくしつ', icon: '🔧', bg: '#eceff1', text: '#37474f', btnBg: '#546e7a', btnText: '#fff' },
    { id: 'castle_gold', name: 'きんいろのしろ', icon: '🏰', bg: '#fffde7', text: '#795548', btnBg: '#fbc02d', btnText: '#3e2723' },
    { id: 'cloud', name: 'くものうえ', icon: '☁️', bg: '#f8fbff', text: '#1565c0', btnBg: '#90caf9', btnText: '#0d47a1' },
    { id: 'aurora', name: 'オーロラ', icon: '🌌', bg: '#e8f5ff', text: '#004d40', btnBg: '#26c6da', btnText: '#00363a' },
    { id: 'mint', name: 'ミント', icon: '🌿', bg: '#e0f7f1', text: '#00695c', btnBg: '#26a69a', btnText: '#fff' },
    { id: 'lavender', name: 'ラベンダー', icon: '💜', bg: '#f3e5ff', text: '#4527a0', btnBg: '#7e57c2', btnText: '#fff' },
    { id: 'peach', name: 'ももいろ', icon: '🍑', bg: '#fff0ed', text: '#bf360c', btnBg: '#ff8a65', btnText: '#fff' },
    { id: 'cocoa', name: 'ココア', icon: '☕', bg: '#efebe9', text: '#3e2723', btnBg: '#6d4c41', btnText: '#fff' },
    { id: 'marble', name: 'だいりせき', icon: '▫️', bg: '#fafafa', text: '#37474f', btnBg: '#90a4ae', btnText: '#102027' },
    { id: 'neon', name: 'ネオン', icon: '💡', bg: '#111827', text: '#a7f3d0', btnBg: '#10b981', btnText: '#052e2b' },
    { id: 'cyber', name: 'サイバー', icon: '⌨️', bg: '#0f172a', text: '#38bdf8', btnBg: '#2563eb', btnText: '#fff' },
    { id: 'retro', name: 'レトロ', icon: '📺', bg: '#fff7ed', text: '#7c2d12', btnBg: '#ea580c', btnText: '#fff' },
    { id: 'paper', name: 'ノート', icon: '📄', bg: '#fffdf5', text: '#263238', btnBg: '#607d8b', btnText: '#fff' },
    { id: 'chalk', name: 'こくばん', icon: '🧽', bg: '#e8f5e9', text: '#1b5e20', btnBg: '#2e7d32', btnText: '#fff' },
    { id: 'lemon', name: 'レモン', icon: '🍋', bg: '#fffde7', text: '#827717', btnBg: '#d4e157', btnText: '#263238' },
    { id: 'soda', name: 'ソーダ', icon: '🥤', bg: '#e0f7fa', text: '#006064', btnBg: '#00acc1', btnText: '#fff' },
    { id: 'grape', name: 'ぶどう', icon: '🍇', bg: '#f3e5f5', text: '#4a148c', btnBg: '#8e24aa', btnText: '#fff' },
    { id: 'coral', name: 'さんご', icon: '🪸', bg: '#fff3f0', text: '#c2185b', btnBg: '#f06292', btnText: '#fff' },
    { id: 'emerald', name: 'エメラルド', icon: '🟢', bg: '#e8f5e9', text: '#00695c', btnBg: '#00a86b', btnText: '#fff' },
    { id: 'royal', name: 'ロイヤル', icon: '👑', bg: '#ede7f6', text: '#311b92', btnBg: '#5e35b1', btnText: '#fff' },
    { id: 'pearl', name: 'パール', icon: '⚪', bg: '#f8fafc', text: '#475569', btnBg: '#cbd5e1', btnText: '#0f172a' },
    { id: 'tea', name: 'おちゃ', icon: '🍵', bg: '#f1f8e9', text: '#33691e', btnBg: '#7cb342', btnText: '#fff' },
    { id: 'candy_night', name: 'よるのキャンディ', icon: '🍭', bg: '#2e1065', text: '#f9a8d4', btnBg: '#db2777', btnText: '#fff' },
    { id: 'prism', name: 'プリズム', icon: '🔷', bg: '#eff6ff', text: '#1d4ed8', btnBg: '#60a5fa', btnText: '#fff' },
    { id: 'candy_shop', name: 'おかしやさん', icon: '🍪', bg: '#fff7ed', text: '#9a3412', btnBg: '#fb923c', btnText: '#fff' },
    { id: 'star_room', name: 'ほしのへや', icon: '⭐', bg: '#0f172a', text: '#fde68a', btnBg: '#f59e0b', btnText: '#111827' },
    { id: 'moonlight', name: 'つきあかり', icon: '🌙', bg: '#eef2ff', text: '#3730a3', btnBg: '#818cf8', btnText: '#fff' },
    { id: 'morning', name: 'あさひ', icon: '🌅', bg: '#fff7ed', text: '#c2410c', btnBg: '#f97316', btnText: '#fff' },
    { id: 'bakery', name: 'パンやさん', icon: '🥐', bg: '#fff8e1', text: '#6d4c41', btnBg: '#d97706', btnText: '#fff' },
    { id: 'robot_lab', name: 'ロボットラボ', icon: '🤖', bg: '#e2e8f0', text: '#0f172a', btnBg: '#475569', btnText: '#fff' },
    { id: 'garden', name: 'はなぞの', icon: '🌼', bg: '#f0fdf4', text: '#166534', btnBg: '#22c55e', btnText: '#fff' },
    { id: 'fireworks', name: 'はなび', icon: '🎆', bg: '#111827', text: '#fef3c7', btnBg: '#ef4444', btnText: '#fff' },
    { id: 'snowtown', name: 'ゆきのまち', icon: '🏔️', bg: '#eff6ff', text: '#1e40af', btnBg: '#3b82f6', btnText: '#fff' },
    { id: 'rain', name: 'あめあがり', icon: '☔', bg: '#e0f2fe', text: '#075985', btnBg: '#0ea5e9', btnText: '#fff' },
    { id: 'map', name: 'たからのちず', icon: '🗺️', bg: '#fef3c7', text: '#92400e', btnBg: '#f59e0b', btnText: '#fff' },
    { id: 'compass', name: 'コンパス', icon: '🧭', bg: '#ecfeff', text: '#155e75', btnBg: '#0891b2', btnText: '#fff' },
    { id: 'puzzle', name: 'パズル', icon: '🧩', bg: '#f5f3ff', text: '#5b21b6', btnBg: '#8b5cf6', btnText: '#fff' },
    { id: 'ribbon', name: 'リボン', icon: '🎀', bg: '#fdf2f8', text: '#9d174d', btnBg: '#f472b6', btnText: '#fff' },
    { id: 'pastel', name: 'パステル', icon: '🎨', bg: '#fefce8', text: '#475569', btnBg: '#a7f3d0', btnText: '#0f172a' },
    { id: 'piano', name: 'ピアノ', icon: '🎹', bg: '#f8fafc', text: '#111827', btnBg: '#111827', btnText: '#fff' },
    { id: 'rocket_base', name: 'ロケットきち', icon: '🚀', bg: '#e0f2fe', text: '#0c4a6e', btnBg: '#0284c7', btnText: '#fff' },
    { id: 'cloud_castle', name: 'くものおしろ', icon: '🏯', bg: '#f0f9ff', text: '#0369a1', btnBg: '#7dd3fc', btnText: '#0c4a6e' },
    { id: 'treasure', name: 'たからばこ', icon: '🧰', bg: '#fffbeb', text: '#78350f', btnBg: '#d97706', btnText: '#fff' }
];

export const EFFECTS =[
    {id:'default', name:'紙吹雪', icon:'🎉', emojis:[]},
    {id:'effect_star', name:'お星さま', icon:'🌟', emojis:['🌟', '⭐', '✨']},
    {id:'effect_heart', name:'ハート', icon:'💖', emojis:['💖', '💕', '💗']},
    {id:'effect_flower', name:'お花', icon:'🌸', emojis:['🌸', '💮', '🌺']},
    {id:'effect_snow', name:'ゆき', icon:'❄️', emojis:['❄️', '⛄', '🧊']},
    {id:'eff_spring', name:'さくらふぶき', icon:'🌸', emojis:['🌸', '💮', '🍃']},
    {id:'eff_sunflower', name:'ひまわり', icon:'🌻', emojis:['🌻', '✨', '💛']},
    {id:'eff_autumn', name:'もみじとはっぱ', icon:'🍁', emojis:['🍁', '🍂', '🍄']},
    {id:'eff_ice', name:'ゆきだるま', icon:'⛄', emojis:['⛄', '❄️', '🧊']},
    {id:'eff_volcano', name:'ほのお', icon:'🔥', emojis:['🔥', '💥', '🎇']},
    {id:'eff_forest', name:'もりのどうぶつ', icon:'🐻', emojis:['🐻', '🐰', '🦊']},
    {id:'eff_desert', name:'ヤシのき', icon:'🌴', emojis:['🌴', '🥥', '☀️']},
    {id:'eff_thunder', name:'かみなり', icon:'⚡', emojis:['⚡', '🌩️', '💧']},
    {id:'eff_rainbow', name:'にじとくも', icon:'🌈', emojis:['🌈', '☁️', '🕊️']},
    {id:'eff_sunset', name:'ゆうやけカラス', icon:'🌇', emojis:['🌇', '🐦', '🌆']},
    {id:'eff_beach', name:'うみのいきもの', icon:'🐠', emojis:['🐠', '🐬', '🐚']},
    {id:'eff_cave', name:'コウモリ', icon:'🦇', emojis:['🦇', '🕸️', '🌑']},
    {id:'eff_savanna', name:'サバンナのけもの', icon:'🦁', emojis:['🦁', '🦓', '🦒']},
    {id:'eff_penguin', name:'ペンギン', icon:'🐧', emojis:['🐧', '🐟', '❄️']},
    {id:'eff_dino', name:'きょうりゅう', icon:'🦖', emojis:['🦖', '🦕', '🌋']},
    {id:'eff_insect', name:'むし', icon:'🦋', emojis:['🦋', '🐞', '🐝']},
    {id:'eff_deepsea', name:'しんかい', icon:'🦑', emojis:['🦑', '🐙', '🫧']},
    {id:'eff_jungle', name:'トラとサル', icon:'🐅', emojis:['🐅', '🐒', '🍌']},
    {id:'eff_nebula', name:'ほしとつき', icon:'🌌', emojis:['⭐', '🌙', '🌠']},
    {id:'eff_frog', name:'カエルとたまじゃくし', icon:'🐸', emojis:['🐸', '💧', '🌿']},
    {id:'eff_crystal', name:'クリスタル', icon:'💎', emojis:['💎', '🔷', '✨']},
    {id:'eff_candy', name:'キャンディ', icon:'🍬', emojis:['🍬', '🍭', '✨']},
    {id:'eff_festival', name:'ちょうちん', icon:'🏮', emojis:['🏮', '🎆', '✨']},
    {id:'eff_classroom', name:'ノートとえんぴつ', icon:'📘', emojis:['📘', '✏️', '💮']},
    {id:'eff_library', name:'ほんのページ', icon:'📚', emojis:['📚', '📖', '🔖']},
    {id:'eff_music', name:'おんぷ', icon:'🎵', emojis:['🎵', '🎶', '✨']},
    {id:'eff_sports', name:'メダル', icon:'🏅', emojis:['🏅', '🏆', '✨']},
    {id:'eff_workshop', name:'こうぐ', icon:'🔧', emojis:['🔧', '🔩', '✨']},
    {id:'eff_castle_gold', name:'きんいろ', icon:'👑', emojis:['👑', '✨', '🏰']},
    {id:'eff_cloud', name:'ふわふわくも', icon:'☁️', emojis:['☁️', '✨', '💧']},
    {id:'eff_aurora', name:'オーロラ', icon:'🌌', emojis:['🌌', '💫', '✨']},
    {id:'eff_mint', name:'ミントリーフ', icon:'🌿', emojis:['🌿', '🍃', '✨']},
    {id:'eff_lavender', name:'ラベンダー', icon:'💜', emojis:['💜', '🟣', '✨']},
    {id:'eff_peach', name:'もも', icon:'🍑', emojis:['🍑', '🌸', '✨']},
    {id:'eff_cocoa', name:'ココア', icon:'☕', emojis:['☕', '🍫', '✨']},
    {id:'eff_marble', name:'だいりせき', icon:'▫️', emojis:['▫️', '◻️', '✨']},
    {id:'eff_neon', name:'ネオンライト', icon:'💡', emojis:['💡', '🟢', '🔵']},
    {id:'eff_cyber', name:'サイバーコード', icon:'⌨️', emojis:['⌨️', '💠', '🔷']},
    {id:'eff_retro', name:'レトロスター', icon:'📺', emojis:['📺', '⭐', '✨']},
    {id:'eff_paper', name:'かみふぶき', icon:'📄', emojis:['📄', '📝', '✨']},
    {id:'eff_chalk', name:'チョーク', icon:'🧽', emojis:['🧽', '⬜', '💮']},
    {id:'eff_lemon', name:'レモン', icon:'🍋', emojis:['🍋', '✨', '💛']},
    {id:'eff_soda', name:'ソーダ', icon:'🥤', emojis:['🥤', '🫧', '✨']},
    {id:'eff_grape', name:'ぶどう', icon:'🍇', emojis:['🍇', '💜', '✨']},
    {id:'eff_coral', name:'さんご', icon:'🪸', emojis:['🪸', '💗', '✨']},
    {id:'eff_emerald', name:'エメラルド', icon:'🟢', emojis:['🟢', '💚', '✨']},
    {id:'eff_royal', name:'クラウン', icon:'👑', emojis:['👑', '💎', '✨']},
    {id:'eff_pearl', name:'パール', icon:'⚪', emojis:['⚪', '🤍', '✨']},
    {id:'eff_tea', name:'おちゃのゆげ', icon:'🍵', emojis:['🍵', '🌿', '✨']},
    {id:'eff_candy_night', name:'よるのおかし', icon:'🍭', emojis:['🍭', '🌙', '✨']},
    {id:'eff_prism', name:'プリズム', icon:'🔷', emojis:['🔷', '🔶', '✨']},
    {id:'eff_candy_shop', name:'クッキー', icon:'🍪', emojis:['🍪', '🍬', '✨']},
    {id:'eff_star_room', name:'ほしのへや', icon:'⭐', emojis:['⭐', '🌟', '✨']},
    {id:'eff_moonlight', name:'つきあかり', icon:'🌙', emojis:['🌙', '✨', '💫']},
    {id:'eff_morning', name:'あさひ', icon:'🌅', emojis:['🌅', '☀️', '✨']},
    {id:'eff_bakery', name:'パンのかおり', icon:'🥐', emojis:['🥐', '🍞', '✨']},
    {id:'eff_robot_lab', name:'ロボット', icon:'🤖', emojis:['🤖', '⚙️', '✨']},
    {id:'eff_garden', name:'はなぞの', icon:'🌼', emojis:['🌼', '🌷', '✨']},
    {id:'eff_fireworks', name:'はなび', icon:'🎆', emojis:['🎆', '🎇', '✨']},
    {id:'eff_snowtown', name:'ゆきのまち', icon:'🏔️', emojis:['🏔️', '❄️', '✨']},
    {id:'eff_rain', name:'あめつぶ', icon:'☔', emojis:['☔', '💧', '✨']},
    {id:'eff_map', name:'ちず', icon:'🗺️', emojis:['🗺️', '📍', '✨']},
    {id:'eff_compass', name:'コンパス', icon:'🧭', emojis:['🧭', '✨', '📍']},
    {id:'eff_puzzle', name:'パズル', icon:'🧩', emojis:['🧩', '✨', '💠']},
    {id:'eff_ribbon', name:'リボン', icon:'🎀', emojis:['🎀', '💗', '✨']},
    {id:'eff_pastel', name:'パステル', icon:'🎨', emojis:['🎨', '🟡', '🟣']},
    {id:'eff_piano', name:'ピアノ', icon:'🎹', emojis:['🎹', '🎵', '✨']},
    {id:'eff_rocket_base', name:'ロケット', icon:'🚀', emojis:['🚀', '⭐', '✨']},
    {id:'eff_cloud_castle', name:'くものおしろ', icon:'🏯', emojis:['🏯', '☁️', '✨']},
    {id:'eff_treasure', name:'たからばこ', icon:'🧰', emojis:['🧰', '💎', '✨']}
];
