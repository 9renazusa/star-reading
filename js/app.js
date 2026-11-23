/*
 * STAR READING — Web v1 app
 * Static SPA: home / birth-data setup / chart / today's line / lesson player.
 * All personal data stays in localStorage. Nothing is sent anywhere.
 */
(function () {
  'use strict';

  var SC = window.StarChart;
  var Core = window.StarCore;
  var LS_KEY = 'star-reading-v1';

  var PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  var PLANET_JA = {
    Sun: '太陽', Moon: '月', Mercury: '水星', Venus: '金星', Mars: '火星',
    Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星'
  };
  var FUTURE_UNITS = [
    { no: 2, name: 'Signs', ja: '星座', theme: '12星座と、性質を表す言葉' },
    { no: 3, name: 'My Placements', ja: '自分の配置', theme: '「My Sun is in Cancer」と自分の配置が言える' },
    { no: 4, name: 'More Planets', ja: '残りの惑星', theme: '木星から冥王星まで' },
    { no: 5, name: 'Houses', ja: 'ハウス', theme: '生活の場面と、ASC・MC' },
    { no: 6, name: 'Aspects', ja: 'アスペクト', theme: '星と星、人と人の関係' },
    { no: 7, name: 'Elements', ja: '元素と区分', theme: '火・地・風・水で性格を表す' },
    { no: 8, name: 'Transits', ja: 'トランジット', theme: '時間の言葉と Today\u2019s Line 入門' },
    { no: 9, name: 'Feelings', ja: '感情と心', theme: 'Co-Star 頻出の心の語彙' },
    { no: 10, name: 'Life', ja: '仕事と日常', theme: 'カテゴリ別の運勢を読む' },
    { no: 11, name: 'Reading', ja: '長文読解', theme: 'Co-Star の長い文に挑む' },
    { no: 12, name: 'Graduation', ja: '卒業', theme: '自分の言葉で読む・書く' }
  ];

  /* ---------------- state ---------------- */

  function defaultState() {
    return { birth: null, xp: 0, completed: {}, lineDate: null, profileLang: 'ja' };
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          var d = defaultState();
          Object.keys(d).forEach(function (k) { if (s[k] !== undefined) d[k] = s[k]; });
          return d;
        }
      }
    } catch (e) { /* fall through */ }
    return defaultState();
  }
  var state = loadState();
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var unitData = null;   // data/unit1.json
  var readingsCore = null; // data/readings-core.json
  var profileData = null;  // data/readings-profile.json
  var chartCache = null; // StarChart.computeChart result for state.birth
  var currentView = 'home';

  function computeUserChart() {
    if (!state.birth) return null;
    var d = Core.birthToUtcDate(state.birth);
    return SC.computeChart(d, Number(state.birth.lat), Number(state.birth.lon));
  }

  /* ---------------- helpers ---------------- */

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtDeg(d) {
    var deg = Math.floor(d);
    var min = Math.floor((d - deg) * 60 + 1e-9);
    if (min === 60) { deg += 1; min = 0; }
    return deg + '°' + (min < 10 ? '0' : '') + min + '′';
  }
  function todayStr() {
    var n = new Date();
    return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
  }
  function mastered() {
    if (!unitData) return { words: [], terms: [] };
    return Core.masteredSets(unitData, state.completed);
  }

  /* ---------------- navigation ---------------- */

  var VIEWS = ['home', 'setup', 'chart', 'profile', 'today', 'lesson'];
  function showView(name) {
    currentView = name;
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    var nav = $('main-nav').querySelectorAll('button');
    nav.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === name); });
    if (name === 'home') renderHome();
    if (name === 'setup') renderSetup();
    if (name === 'chart') renderChart();
    if (name === 'profile') renderProfile();
    if (name === 'today') renderToday();
    renderStatus();
    window.scrollTo(0, 0);
  }
  function renderStatus() {
    var ms = mastered();
    $('status-bar').innerHTML =
      '<span>XP <b>' + state.xp + '</b></span>' +
      '<span>WORDS <b>' + ms.words.length + '</b> / ' + Core.TOTAL_GENERAL_WORDS + '</span>';
  }

  /* ---------------- home ---------------- */

  function renderHome() {
    var el = $('view-home');
    var ms = mastered();
    var html = '';

    if (!state.birth) {
      html += '<div class="notice"><b>はじめに出生情報を入力してください。</b><br>' +
        'あなたの出生チャートが、そのまま英語学習の教材になります。データはこのブラウザの中にだけ保存されます。' +
        '<div class="btn-row"><button class="btn" id="home-setup">出生情報を入力する</button></div></div>';
    }

    html += '<div class="card"><p class="card-label">YOUR PROGRESS</p>' +
      '<div class="big-number">' + ms.words.length + ' <small>/ 1,500 WORDS MASTERED</small></div>' +
      '<div class="progress-line"><div style="width:' + (ms.words.length / Core.TOTAL_GENERAL_WORDS * 100).toFixed(1) + '%"></div></div>' +
      '<p class="small">専門用語 ' + ms.terms.length + ' 語 ／ XP ' + state.xp + '</p></div>';

    if (state.birth && chartCache) {
      var moonToday = SC.signOf(SC.planetLongitudes(new Date()).Moon);
      html += '<div class="card"><p class="card-label">TODAY\u2019S LINE</p>' +
        '<p class="lead">今日の月は ' + esc(moonToday.en) + '（' + esc(moonToday.ja) + '）。' +
        'あなたのチャートと重ねて読む、今日の一文です。</p>' +
        '<div class="btn-row"><button class="btn" id="home-today">今日の一文を読む</button></div></div>';

      html += '<div class="card"><p class="card-label">MY PROFILE READING</p>' +
        '<p class="lead">あなたの出生チャートから作る基本鑑定です。日本語と英語で読めて、' +
        '自己紹介にも使えるサマリーが付いています。英語版をスラスラ読めるようになるのが、ひとつのゴールです。</p>' +
        '<div class="btn-row"><button class="btn" id="home-profile">わたしの基本鑑定を読む</button></div></div>';
    }

    html += '<h2 class="view-title">Units</h2>';

    if (!unitData) {
      html += '<div class="error-box">レッスンデータ（data/unit1.json）を読み込めませんでした。' +
        'ファイルを直接開いている場合は、ローカルサーバー経由で開いてください（例：<code>python3 -m http.server</code>）。</div>';
    } else {
      var u = unitData.unit;
      html += '<div class="unit"><div class="unit-head">' +
        '<div class="unit-no">UNIT ' + u.order + '</div>' +
        '<div class="unit-name">' + esc(u.title_en) + ' — ' + esc(u.title_ja) + '</div>' +
        '<div class="unit-theme">' + esc(u.theme_ja) + '</div></div>';
      unitData.lessons.forEach(function (lesson, i) {
        var done = !!state.completed[lesson.id];
        var unlocked = i === 0 || !!state.completed[unitData.lessons[i - 1].id];
        var st = done ? '✓ DONE' : (unlocked ? 'START →' : 'LOCKED');
        html += '<button class="lesson-row" data-lesson="' + esc(lesson.id) + '"' + (unlocked ? '' : ' disabled') + '>' +
          '<span class="no">' + u.order + '.' + lesson.order + '</span>' +
          '<span class="ttl">' + esc(lesson.title_ja) + '<span class="en">' + esc(lesson.title_en) +
          ' ／ 新しい語 ' + lesson.newWords.length + ' ＋ 用語 ' + lesson.newTerms.length + '</span></span>' +
          '<span class="st">' + st + '</span></button>';
      });
      html += '</div>';
    }

    FUTURE_UNITS.forEach(function (fu) {
      html += '<div class="unit locked"><div class="unit-head">' +
        '<div class="unit-no">UNIT ' + fu.no + ' — COMING SOON</div>' +
        '<div class="unit-name">' + esc(fu.name) + ' — ' + esc(fu.ja) + '</div>' +
        '<div class="unit-theme">' + esc(fu.theme) + '</div></div></div>';
    });

    el.innerHTML = html;
    var bs = $('home-setup'); if (bs) bs.addEventListener('click', function () { showView('setup'); });
    var bt = $('home-today'); if (bt) bt.addEventListener('click', function () { showView('today'); });
    var bp = $('home-profile'); if (bp) bp.addEventListener('click', function () { showView('profile'); });
    el.querySelectorAll('[data-lesson]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lesson = unitData.lessons.filter(function (l) { return l.id === btn.getAttribute('data-lesson'); })[0];
        if (lesson) startLesson(lesson);
      });
    });
  }

  /* ---------------- setup ---------------- */

  function renderSetup() {
    var el = $('view-setup');
    var b = state.birth || { date: '', time: '', timeUnknown: false, placeName: '', lat: 35.61, lon: 140.11, utcOffset: 9 };
    var cityOptions = Core.CITIES.map(function (c) {
      return '<option value="' + esc(Core.cityLabel(c)) + '"></option>';
    }).join('');
    el.innerHTML =
      '<h2 class="view-title">Birth Data</h2>' +
      '<p class="lead">生まれた日・時刻・場所から、あなたの出生チャートを計算します。</p>' +
      '<form id="birth-form">' +
      '<div class="field"><label for="f-date">生年月日</label>' +
      '<input type="date" id="f-date" required value="' + esc(b.date) + '"></div>' +
      '<div class="field"><label for="f-time">出生時刻</label>' +
      '<input type="time" id="f-time" value="' + esc(b.time || '') + '"' + (b.timeUnknown ? ' disabled' : '') + '></div>' +
      '<label class="check"><input type="checkbox" id="f-unknown"' + (b.timeUnknown ? ' checked' : '') + '> 出生時刻がわからない（制限モード）</label>' +
      '<p class="small">時刻がわからない場合は正午で計算し、天体の星座配置のみを表示します。ハウスとASC/MCは時刻に依存するため表示しません。</p>' +
      '<div class="field"><label for="f-city">出生地を検索（都市名を入力すると緯度・経度・時差が入ります）</label>' +
      '<input type="text" id="f-city" list="city-list" autocomplete="off" placeholder="例：大阪、Osaka、鹿児島">' +
      '<datalist id="city-list">' + cityOptions + '</datalist></div>' +
      '<p class="small">プリセットは全都道府県庁所在地＋政令指定都市と、主な海外都市です。リストにない場所（海外の都市も含みます）は、下の緯度・経度・UTC時差を直接入力すれば、そのまま計算に使えます。</p>' +
      '<div class="field"><label for="f-place">出生地の名前（表示用）</label>' +
      '<input type="text" id="f-place" value="' + esc(b.placeName || '') + '" placeholder="例：千葉"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="f-lat">緯度（北緯＋／南緯−）</label><input type="number" id="f-lat" step="0.0001" min="-90" max="90" value="' + esc(b.lat) + '"></div>' +
      '<div class="field"><label for="f-lon">経度（東経＋／西経−）</label><input type="number" id="f-lon" step="0.0001" min="-180" max="180" value="' + esc(b.lon) + '"></div>' +
      '<div class="field"><label for="f-tz">UTC時差（日本は9）</label><input type="number" id="f-tz" step="0.5" min="-14" max="14" value="' + esc(b.utcOffset) + '"></div>' +
      '</div>' +
      '<div class="btn-row"><button type="submit" class="btn">保存してチャートを見る</button></div>' +
      '</form>' +
      (state.birth ?
        '<h3 class="block-title">データの削除</h3>' +
        '<div class="btn-row"><button class="btn ghost" id="del-birth">出生データだけ削除</button>' +
        '<button class="btn ghost" id="del-all">学習記録も含めて全部削除</button></div>' : '');

    function applyCity() {
      var c = Core.findCity($('f-city').value);
      if (!c) return;
      $('f-lat').value = c.lat; $('f-lon').value = c.lon; $('f-tz').value = c.utcOffset;
      if (!$('f-place').value) $('f-place').value = c.name_ja;
    }
    $('f-city').addEventListener('change', applyCity);
    $('f-city').addEventListener('input', applyCity);
    $('f-unknown').addEventListener('change', function () { $('f-time').disabled = this.checked; });
    $('birth-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var unknown = $('f-unknown').checked;
      var birth = {
        date: $('f-date').value,
        time: unknown ? '' : $('f-time').value,
        timeUnknown: unknown,
        placeName: $('f-place').value.trim(),
        lat: parseFloat($('f-lat').value),
        lon: parseFloat($('f-lon').value),
        utcOffset: parseFloat($('f-tz').value)
      };
      if (!birth.date || isNaN(birth.utcOffset)) {
        alert('生年月日と時差を入力してください。');
        return;
      }
      var latLonError = Core.validateLatLon(birth.lat, birth.lon);
      if (latLonError) {
        alert(latLonError);
        return;
      }
      if (!unknown && !birth.time) {
        alert('出生時刻を入力するか、「出生時刻がわからない」にチェックしてください。');
        return;
      }
      state.birth = birth;
      chartCache = computeUserChart();
      saveState();
      showView('chart');
    });
    var db = $('del-birth');
    if (db) db.addEventListener('click', function () {
      if (!confirm('出生データを削除しますか？（学習記録は残ります）')) return;
      state.birth = null; chartCache = null; saveState(); showView('home');
    });
    var da = $('del-all');
    if (da) da.addEventListener('click', function () {
      if (!confirm('出生データと学習記録をすべて削除しますか？')) return;
      state = defaultState(); chartCache = null; saveState(); showView('home');
    });
  }

  /* ---------------- chart ---------------- */

  function renderChart() {
    var el = $('view-chart');
    if (!state.birth || !chartCache) {
      el.innerHTML = '<h2 class="view-title">Your Chart</h2>' +
        '<div class="notice">まだ出生情報がありません。<div class="btn-row">' +
        '<button class="btn" id="chart-setup">出生情報を入力する</button></div></div>';
      $('chart-setup').addEventListener('click', function () { showView('setup'); });
      return;
    }
    var b = state.birth;
    var ch = chartCache;
    var limited = !!b.timeUnknown;
    var html = '<h2 class="view-title">Your Chart</h2>';
    html += '<p class="small">' + esc(b.date) + (limited ? '（時刻不明）' : ' ' + esc(b.time)) +
      (b.placeName ? ' ／ ' + esc(b.placeName) : '') + ' ／ 緯度 ' + b.lat + ' 経度 ' + b.lon + '</p>';
    if (limited) {
      html += '<div class="notice limited"><b>制限モード</b>：出生時刻が不明なため、正午で計算しています。' +
        '天体の星座配置は表示できますが、時刻で決まるハウスとASC/MCは表示していません。</div>';
    }

    html += '<div class="placement-hero">';
    ['Sun', 'Moon'].forEach(function (name) {
      var p = ch.planets[name];
      html += '<div class="hero-line"><div class="pname">' + name.toUpperCase() + ' — ' + PLANET_JA[name] + '</div>' +
        '<div class="pval"><b>' + esc(p.sign.en) + '</b> ' + fmtDeg(p.sign.degreeInSign) +
        ' <span class="small">' + esc(p.sign.ja) + '</span></div></div>';
    });
    if (!limited) {
      html += '<div class="hero-line"><div class="pname">ASCENDANT — 上昇宮</div>' +
        '<div class="pval"><b>' + esc(ch.asc.sign.en) + '</b> ' + fmtDeg(ch.asc.sign.degreeInSign) +
        ' <span class="small">' + esc(ch.asc.sign.ja) + '</span></div></div>';
    }
    html += '</div>';

    html += '<h3 class="block-title">すべての天体</h3><table class="data"><tr><th>PLANET</th><th>SIGN</th><th style="text-align:right">DEGREE</th></tr>';
    PLANET_ORDER.forEach(function (name) {
      var p = ch.planets[name];
      html += '<tr><td>' + name + '（' + PLANET_JA[name] + '）</td><td>' + esc(p.sign.en) + '（' + esc(p.sign.ja) + '）</td>' +
        '<td class="deg">' + fmtDeg(p.sign.degreeInSign) + '</td></tr>';
    });
    html += '</table>';

    html += '<h3 class="block-title">英語で言ってみる</h3>';
    PLANET_ORDER.forEach(function (name) {
      var p = ch.planets[name];
      html += '<div class="myline">My ' + name + ' is in ' + esc(p.sign.en) + '.<span>私の' + PLANET_JA[name] + 'は' + esc(p.sign.ja) + 'にある</span></div>';
    });

    if (!limited) {
      html += '<h3 class="block-title">ハウス（Placidus）</h3>';
      html += '<p class="small">MC（天頂）は ' + esc(ch.mc.sign.en) + '（' + esc(ch.mc.sign.ja) + '）' + fmtDeg(ch.mc.sign.degreeInSign) + ' です。</p>';
      html += '<table class="data"><tr><th>HOUSE</th><th>SIGN</th><th style="text-align:right">DEGREE</th></tr>';
      ch.cusps.forEach(function (c, i) {
        html += '<tr><td>House ' + (i + 1) + '</td><td>' + esc(c.sign.en) + '（' + esc(c.sign.ja) + '）</td>' +
          '<td class="deg">' + fmtDeg(c.sign.degreeInSign) + '</td></tr>';
      });
      html += '</table>';
    }

    html += '<div class="btn-row"><button class="btn" id="chart-profile">わたしの基本鑑定を読む →</button></div>';
    el.innerHTML = html;
    $('chart-profile').addEventListener('click', function () { showView('profile'); });
  }

  /* ---------------- profile reading （基本鑑定） ---------------- */

  var PROFILE_LABELS = {
    sun: { en: 'CORE SELF', ja: '核となる自分' },
    moon: { en: 'INNER SELF', ja: '素の自分・安心の仕方' },
    asc: { en: 'FIRST IMPRESSION', ja: '第一印象・見せ方' },
    mercury: { en: 'MIND & WORDS', ja: '考え方・伝え方' },
    venus: { en: 'LOVE & LIKES', ja: '好きの傾向' },
    mars: { en: 'ACTION', ja: '行動の仕方' }
  };

  function renderProfile() {
    var el = $('view-profile');
    if (!state.birth || !chartCache) {
      el.innerHTML = '<h2 class="view-title">My Profile Reading</h2>' +
        '<div class="notice">出生情報を入力すると、あなたの基本鑑定が作られます。<div class="btn-row">' +
        '<button class="btn" id="profile-setup">出生情報を入力する</button></div></div>';
      $('profile-setup').addEventListener('click', function () { showView('setup'); });
      return;
    }
    if (!readingsCore || !profileData) {
      el.innerHTML = '<h2 class="view-title">My Profile Reading</h2>' +
        '<div class="error-box">鑑定文データ（data/readings-core.json / data/readings-profile.json）を読み込めませんでした。' +
        'ファイルを直接開いている場合は、ローカルサーバー経由で開いてください（例：<code>python3 -m http.server</code>）。</div>';
      return;
    }
    var limited = !!state.birth.timeUnknown;
    var profile = Core.buildProfileReading(chartCache, readingsCore, profileData, limited);
    if (!profile) {
      el.innerHTML = '<h2 class="view-title">My Profile Reading</h2>' +
        '<div class="error-box">鑑定文を組み立てられませんでした。データファイルの内容を確認してください。</div>';
      return;
    }
    var lang = state.profileLang === 'en' ? 'en' : 'ja';

    var html = '<h2 class="view-title">My Profile Reading — わたしの基本鑑定</h2>';
    html += '<div class="lang-toggle" role="group" aria-label="Language">' +
      '<button type="button" id="lang-ja" class="' + (lang === 'ja' ? 'active' : '') + '">日本語</button>' +
      '<button type="button" id="lang-en" class="' + (lang === 'en' ? 'active' : '') + '">ENGLISH</button></div>';

    if (limited) {
      html += '<div class="notice limited"><b>制限モード</b>：出生時刻が不明なため、ASC（アセンダント）とハウスに依存する文は表示していません。' +
        '太陽・月・水星・金星・火星の文は、時刻がなくても読めます。</div>';
    }

    html += '<div class="card"><p class="card-label">PROFILE — プロフィール一文</p>' +
      '<div class="profile-line">' + esc(lang === 'en' ? profile.profileLine.en : profile.profileLine.ja) + '</div>' +
      '<p class="small">' + esc(lang === 'en' ? profile.profileLine.ja : profile.profileLine.en) + '</p></div>';

    profile.sections.forEach(function (s) {
      var label = PROFILE_LABELS[s.key] || { en: '', ja: '' };
      var main = lang === 'en' ? s.en : s.ja;
      var sub = lang === 'en' ? s.ja : s.en;
      html += '<div class="profile-block"><p class="p-label">' +
        esc(s.planet.toUpperCase()) + ' IN ' + esc(s.signEn.toUpperCase()) + ' — ' + esc(label.en) + '／' + esc(label.ja) + '</p>' +
        '<div class="p-main">' + esc(main) + '</div>' +
        '<div class="p-sub">' + esc(sub) + '</div></div>';
    });

    html += '<h3 class="block-title">自己紹介サマリー — PROFILE SUMMARY</h3>' +
      '<div class="card"><div class="' + (lang === 'en' ? 'today-en' : 'profile-summary-ja') + '">' +
      esc(lang === 'en' ? profile.summary.en : profile.summary.ja) + '</div>' +
      '<div class="today-ja">' + esc(lang === 'en' ? profile.summary.ja : profile.summary.en) + '</div></div>';

    html += '<p class="small">※ 傾向を読むための文章です。未来や性格を断定するものではありません。英語版は、学習の進度に合わせてスラスラ読めるようになることを目指す文章です。</p>';

    el.innerHTML = html;
    $('lang-ja').addEventListener('click', function () {
      if (state.profileLang !== 'ja') { state.profileLang = 'ja'; saveState(); renderProfile(); }
    });
    $('lang-en').addEventListener('click', function () {
      if (state.profileLang !== 'en') { state.profileLang = 'en'; saveState(); renderProfile(); }
    });
  }

  /* ---------------- today's line ---------------- */

  function renderToday() {
    var el = $('view-today');
    if (!state.birth || !chartCache) {
      el.innerHTML = '<h2 class="view-title">Today\u2019s Line</h2>' +
        '<div class="notice">出生情報を入力すると、今日の月とあなたのチャートから一文が作られます。<div class="btn-row">' +
        '<button class="btn" id="today-setup">出生情報を入力する</button></div></div>';
      $('today-setup').addEventListener('click', function () { showView('setup'); });
      return;
    }
    var now = new Date();
    var moonToday = SC.signOf(SC.planetLongitudes(now).Moon);
    var natalMoon = chartCache.planets.Moon.sign;
    var line = Core.buildTodaysLine(SC.SIGNS_EN, SC.SIGNS_JA, moonToday.index, natalMoon.index, now.getDate());
    var doneToday = state.lineDate === todayStr();

    var html = '<h2 class="view-title">Today\u2019s Line</h2>';
    html += '<p class="small">' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() +
      ' — 今日の月は ' + esc(moonToday.ja) + '（' + esc(moonToday.en) + '）にあります。</p>';
    html += '<div class="card"><p class="card-label">TODAY\u2019S LINE</p><div class="today-en">' +
      line.lines_en.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join('') + '</div>' +
      '<div class="today-ja">' + esc(line.ja_summary) + '</div>' +
      '<p class="small">※ 傾向を読むための練習文です。未来を断定するものではありません。</p></div>';

    html += '<h3 class="block-title">読み取りチェック</h3>' +
      '<p class="prompt-ja">' + esc(line.quiz.prompt_ja) + '</p><div class="options">' +
      line.quiz.options.map(function (o, i) {
        return '<button class="option" data-opt="' + i + '">' + esc(o) + '</button>';
      }).join('') + '</div><div id="today-feedback"></div>' +
      (doneToday ? '<p class="small">今日のチェックは完了済みです（+5 XP 獲得済み）。復習として何度でも解けます。</p>' : '');

    el.innerHTML = html;
    el.querySelectorAll('[data-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.querySelectorAll('[data-opt]').forEach(function (x) { x.classList.remove('selected'); });
        btn.classList.add('selected');
        var i = Number(btn.getAttribute('data-opt'));
        var correct = i === line.quiz.answerIndex;
        var fb = $('today-feedback');
        if (correct) {
          var gain = 0;
          if (state.lineDate !== todayStr()) {
            gain = 5; state.xp += 5; state.lineDate = todayStr(); saveState(); renderStatus();
          }
          fb.innerHTML = '<div class="feedback"><div class="verdict">CORRECT' + (gain ? ' +' + gain + ' XP' : '') + '</div>' +
            esc(line.quiz.explanation_ja) + '</div>';
        } else {
          fb.innerHTML = '<div class="feedback bad"><div class="verdict">NOT YET</div>' +
            'もう一度、文の中の feel のあとを読んでみてください。</div>';
        }
      });
    });
  }

  /* ---------------- lesson player ---------------- */

  var session = null;

  function startLesson(lesson) {
    session = {
      lesson: lesson,
      phase: 'intro',
      queue: lesson.exercises.map(function (_, i) { return i; }),
      attempts: {},
      xp: 0,
      doneCount: 0,
      selected: null,
      answerTiles: [],
      poolTiles: null
    };
    showView('lesson');
    renderLesson();
  }

  function currentExercise() {
    return session.lesson.exercises[session.queue[0]];
  }

  function renderLesson() {
    var el = $('view-lesson');
    var lesson = session.lesson;
    if (session.phase === 'intro') {
      var html = '<p class="small">UNIT 1 — LESSON ' + lesson.order + '</p>' +
        '<h2 class="view-title" style="font-size:20px; letter-spacing:0.08em; text-transform:none">' + esc(lesson.title_ja) + '</h2>' +
        '<p class="lead">' + esc(lesson.theme_ja) + '</p>' +
        '<p class="small">文型：' + esc(lesson.pattern) + ' ／ 目標：' + esc(lesson.canDo_ja) + '</p>';
      html += '<h3 class="block-title">新しい専門用語</h3><table class="word-table">' +
        lesson.newTerms.map(function (t) {
          return '<tr><td>' + esc(t.en) + '</td><td>' + esc(t.ja) + '<br><span class="small">' + esc(t.note_ja || '') + '</span></td></tr>';
        }).join('') + '</table>';
      html += '<h3 class="block-title">新しい語（' + lesson.newWords.length + '語）</h3><table class="word-table">' +
        lesson.newWords.map(function (w) {
          return '<tr><td>' + esc(w.en) + '</td><td>' + esc(w.ja) + '</td></tr>';
        }).join('') + '</table>';
      html += '<h3 class="block-title">例文</h3>' +
        lesson.sentences.map(function (s) {
          return '<div class="sentence"><div class="en">' + esc(s.en) + '</div><div class="ja">' + esc(s.ja) + '</div></div>';
        }).join('');
      html += '<div class="btn-row"><button class="btn" id="lesson-start">演習をはじめる（' + lesson.exercises.length + '問）</button>' +
        '<button class="btn ghost" id="lesson-back">もどる</button></div>';
      el.innerHTML = html;
      $('lesson-start').addEventListener('click', function () { session.phase = 'quiz'; renderLesson(); });
      $('lesson-back').addEventListener('click', function () { session = null; showView('home'); });
      return;
    }
    if (session.phase === 'complete') { renderLessonComplete(el); return; }
    renderExercise(el);
  }

  function renderExercise(el) {
    var lesson = session.lesson;
    var ex = currentExercise();
    var pct = Math.round(session.doneCount / lesson.exercises.length * 100);
    var html = '<div class="quiz-progress"><div style="width:' + pct + '%"></div></div>' +
      '<p class="prompt-ja">' + esc(lesson.title_en) + ' — ' + session.doneCount + ' / ' + lesson.exercises.length + ' 問</p>' +
      '<p class="prompt-ja">' + esc(ex.prompt_ja) + '</p>' +
      (ex.promptJa ? '<p class="prompt-ja prompt-target">日本語の文：' + esc(ex.promptJa) + '</p>' : '');

    if (ex.type === 'multiple_choice' || ex.type === 'fill_blank') {
      var q = ex.question_en || ex.sentence_en;
      html += '<p class="question-en">' + esc(q) + '</p><div class="options">' +
        ex.options.map(function (o, i) {
          return '<button class="option" data-opt="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
    } else if (ex.type === 'reorder') {
      if (!session.poolTiles) {
        session.poolTiles = ex.tiles.map(function (t, i) { return { id: i, text: t }; });
        // shuffle pool
        for (var i = session.poolTiles.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = session.poolTiles[i]; session.poolTiles[i] = session.poolTiles[j]; session.poolTiles[j] = tmp;
        }
        session.answerTiles = [];
      }
      html += '<div class="tiles-answer" id="tiles-answer"></div><div class="tiles-pool" id="tiles-pool"></div>' +
        '<p class="small">タイルをタップして文を組み立ててください。答えのタイルをタップすると戻せます。</p>';
    }

    html += '<div id="quiz-action"><div class="btn-row">' +
      '<button class="btn" id="btn-check">CHECK</button>' +
      '<button class="btn ghost" id="btn-quit">やめる</button></div></div>' +
      '<div id="quiz-feedback"></div>';
    el.innerHTML = html;

    if (ex.type === 'multiple_choice' || ex.type === 'fill_blank') {
      el.querySelectorAll('[data-opt]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          el.querySelectorAll('[data-opt]').forEach(function (x) { x.classList.remove('selected'); });
          btn.classList.add('selected');
          session.selected = Number(btn.getAttribute('data-opt'));
        });
      });
    } else if (ex.type === 'reorder') {
      renderTiles();
    }
    $('btn-check').addEventListener('click', judge);
    $('btn-quit').addEventListener('click', function () { session = null; showView('home'); });
  }

  function renderTiles() {
    var ex = currentExercise();
    var ans = $('tiles-answer');
    var pool = $('tiles-pool');
    ans.innerHTML = session.answerTiles.map(function (id) {
      var t = ex.tiles[id];
      return '<button class="tile" data-ans="' + id + '">' + esc(t) + '</button>';
    }).join('') || '<span class="small">ここに文が組み上がります</span>';
    pool.innerHTML = session.poolTiles.filter(function (t) {
      return session.answerTiles.indexOf(t.id) === -1;
    }).map(function (t) {
      return '<button class="tile" data-pool="' + t.id + '">' + esc(t.text) + '</button>';
    }).join('');
    ans.querySelectorAll('[data-ans]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-ans'));
        session.answerTiles = session.answerTiles.filter(function (x) { return x !== id; });
        renderTiles();
      });
    });
    pool.querySelectorAll('[data-pool]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        session.answerTiles.push(Number(btn.getAttribute('data-pool')));
        renderTiles();
      });
    });
  }

  function correctAnswerText(ex) {
    if (ex.type === 'reorder') return ex.answer_en;
    return ex.options[ex.answerIndex];
  }

  function judge() {
    var ex = currentExercise();
    var idx = session.queue[0];
    var correct;
    if (ex.type === 'reorder') {
      if (session.answerTiles.length !== ex.tiles.length) {
        $('quiz-feedback').innerHTML = '<div class="feedback bad"><div class="verdict">NOT YET</div>タイルを全部使って文を完成させてください。</div>';
        return;
      }
      var texts = session.answerTiles.map(function (id) { return ex.tiles[id]; });
      correct = Core.checkReorder(texts, ex.answer_en);
    } else {
      if (session.selected === null) {
        $('quiz-feedback').innerHTML = '<div class="feedback bad"><div class="verdict">NOT YET</div>まず選択肢を選んでください。</div>';
        return;
      }
      correct = session.selected === ex.answerIndex;
    }
    session.attempts[idx] = (session.attempts[idx] || 0) + 1;
    var fb = $('quiz-feedback');
    var act = $('quiz-action');

    if (correct) {
      var gain = session.attempts[idx] === 1 ? 10 : (session.attempts[idx] === 2 ? 5 : 0);
      session.xp += gain;
      session.doneCount++;
      fb.innerHTML = '<div class="feedback"><div class="verdict">CORRECT' + (gain ? ' +' + gain + ' XP' : '') + '</div>' + esc(ex.explanation_ja) + '</div>';
      act.innerHTML = '<div class="btn-row"><button class="btn" id="btn-next">NEXT →</button></div>';
      $('btn-next').addEventListener('click', function () { advance(false); });
    } else if (session.attempts[idx] >= 3) {
      session.doneCount++;
      fb.innerHTML = '<div class="feedback bad"><div class="verdict">ANSWER</div>答えは「' + esc(correctAnswerText(ex)) + '」。' + esc(ex.explanation_ja) + '</div>';
      act.innerHTML = '<div class="btn-row"><button class="btn" id="btn-next">NEXT →</button></div>';
      $('btn-next').addEventListener('click', function () { advance(false); });
    } else {
      fb.innerHTML = '<div class="feedback bad"><div class="verdict">NOT YET</div>' + esc(ex.explanation_ja) + '<br>この問題は、あとでもう一度出てきます。</div>';
      act.innerHTML = '<div class="btn-row"><button class="btn" id="btn-next">NEXT →</button></div>';
      $('btn-next').addEventListener('click', function () { advance(true); });
    }
  }

  function advance(requeue) {
    var idx = session.queue.shift();
    if (requeue) session.queue.push(idx);
    session.selected = null;
    session.answerTiles = [];
    session.poolTiles = null;
    if (!session.queue.length) {
      state.xp += session.xp;
      state.completed[session.lesson.id] = true;
      saveState();
      session.phase = 'complete';
    }
    renderLesson();
    renderStatus();
  }

  function renderLessonComplete(el) {
    var lesson = session.lesson;
    var cl = lesson.chartLine || {};
    var html = '<p class="small">UNIT 1 — LESSON ' + lesson.order + '</p>' +
      '<h2 class="view-title" style="font-size:20px; letter-spacing:0.08em; text-transform:none">LESSON COMPLETE</h2>' +
      '<div class="big-number">+' + session.xp + ' <small>XP</small></div>' +
      '<p class="lead">' + esc(lesson.canDo_ja) + '</p>' +
      '<p>新しい語 ' + lesson.newWords.length + ' 語と、専門用語 ' + lesson.newTerms.length + ' 語をマスターしました。</p>';
    if (cl.template_en) {
      html += '<h3 class="block-title">あなたのチャートに接続する一文</h3>' +
        '<div class="card"><div class="today-en"><p>' + esc(cl.template_en) + '</p></div>' +
        '<div class="today-ja">' + esc(cl.ja || '') + '</div>' +
        (cl.note_ja ? '<p class="small">' + esc(cl.note_ja) + '</p>' : '') + '</div>';
    }
    html += '<div class="btn-row"><button class="btn" id="done-home">HOME へ</button>' +
      (state.birth ? '<button class="btn ghost" id="done-chart">チャートを見る</button>' : '') + '</div>';
    el.innerHTML = html;
    $('done-home').addEventListener('click', function () { session = null; showView('home'); });
    var dc = $('done-chart');
    if (dc) dc.addEventListener('click', function () { session = null; showView('chart'); });
  }

  /* ---------------- init ---------------- */

  $('main-nav').querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () { showView(btn.getAttribute('data-view')); });
  });

  chartCache = computeUserChart();
  showView('home');

  fetch('data/unit1.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { unitData = data; renderHome(); renderStatus(); })
    .catch(function () { unitData = null; renderHome(); renderStatus(); });

  fetch('data/readings-core.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { readingsCore = data; if (currentView === 'profile') renderProfile(); })
    .catch(function () { readingsCore = null; if (currentView === 'profile') renderProfile(); });

  fetch('data/readings-profile.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { profileData = data; if (currentView === 'profile') renderProfile(); })
    .catch(function () { profileData = null; if (currentView === 'profile') renderProfile(); });
})();
