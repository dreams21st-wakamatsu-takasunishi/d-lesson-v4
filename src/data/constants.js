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
    { id: 'v9', title: 'むきあてクイズ', sub: 'おなじむきのものをえらぼう', icon: '🔄', color: '#673AB7' }
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
    { id: 4010, title: 'えいたんご', chars:[{h:'ＡＰＰＬＥ(りんご)', r:['APPLE']},{h:'ＢＯＯＫ(ほん)', r:['BOOK']},{h:'ＤＯＧ(いぬ)', r:['DOG']},{h:'ＣＡＴ(ねこ)', r:['CAT']},{h:'ＰＬＡＹ(あそぶ)', r:['PLAY']}]}
];

export const EXAMS =[
    {id:1101, title:'ホーム試験', gold: 30, silver: 45},{id:1102, title:'上段試験', gold: 35, silver: 50},{id:1103, title:'下段試験', gold: 35, silver: 50},{id:1104, title:'数字試験', gold: 40, silver: 60},
    {id:3301, title:'あ～さ試験', gold: 40, silver: 60},{id:3302, title:'た～は試験', gold: 40, silver: 60},{id:3303, title:'ま～ん試験', gold: 50, silver: 70},{id:3304, title:'濁点試験', gold: 70, silver: 100},
    {id:4101, title:'ことばまとめ(基本)', gold: 60, silver: 90},{id:4102, title:'ことばまとめ(特殊)', gold: 60, silver: 90},{id:4103, title:'ことばまとめ(レベルアップ)', gold: 60, silver: 90},
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
    4001,4002,4003,4004,4101, 4005,4006,4007,4008,4102, 4009,4010,4103, 4999
];

export const KB_CHAPTERS =[
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
    {id:'word3',title:'ことばのれんしゅう(レベルアップ)',stages:[4009,4010],bridge:null,exam:4103}
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
