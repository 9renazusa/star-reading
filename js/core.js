/*
 * STAR READING - shared app logic (no DOM)
 *
 * Used by the browser app (window.StarCore) and by the Node
 * verification harness (module.exports). Pure functions only:
 * birth input -> UTC instant, Today's Line generation, progress math.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.StarCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Birthplace presets (lat: north +, lon: east +, utcOffset hours)   */
  /* All 47 prefectural capitals + the designated cities that are     */
  /* not capitals, then a handful of overseas cities. The list is     */
  /* bundled data (no geocoding API), so it also works offline.       */
  /* DST is not modelled; utcOffset is the standard-time offset and    */
  /* can be edited by hand in the form. Any place not in this list     */
  /* can be entered directly as latitude / longitude numbers.          */
  /* ---------------------------------------------------------------- */
  var CITIES = [
    /* Japan — prefectural capitals, north to south */
    { id: 'sapporo',   name_ja: '札幌',       name_en: 'Sapporo',     lat: 43.06,  lon: 141.35,  utcOffset: 9 },
    { id: 'aomori',    name_ja: '青森',       name_en: 'Aomori',      lat: 40.82,  lon: 140.74,  utcOffset: 9 },
    { id: 'morioka',   name_ja: '盛岡',       name_en: 'Morioka',     lat: 39.70,  lon: 141.15,  utcOffset: 9 },
    { id: 'sendai',    name_ja: '仙台',       name_en: 'Sendai',      lat: 38.27,  lon: 140.87,  utcOffset: 9 },
    { id: 'akita',     name_ja: '秋田',       name_en: 'Akita',       lat: 39.72,  lon: 140.10,  utcOffset: 9 },
    { id: 'yamagata',  name_ja: '山形',       name_en: 'Yamagata',    lat: 38.24,  lon: 140.36,  utcOffset: 9 },
    { id: 'fukushima', name_ja: '福島',       name_en: 'Fukushima',   lat: 37.75,  lon: 140.47,  utcOffset: 9 },
    { id: 'mito',      name_ja: '水戸',       name_en: 'Mito',        lat: 36.34,  lon: 140.45,  utcOffset: 9 },
    { id: 'utsunomiya', name_ja: '宇都宮',    name_en: 'Utsunomiya',  lat: 36.56,  lon: 139.88,  utcOffset: 9 },
    { id: 'maebashi',  name_ja: '前橋',       name_en: 'Maebashi',    lat: 36.39,  lon: 139.06,  utcOffset: 9 },
    { id: 'saitama',   name_ja: 'さいたま',   name_en: 'Saitama',     lat: 35.86,  lon: 139.65,  utcOffset: 9 },
    { id: 'chiba',     name_ja: '千葉',       name_en: 'Chiba',       lat: 35.61,  lon: 140.11,  utcOffset: 9 },
    { id: 'tokyo',     name_ja: '東京',       name_en: 'Tokyo',       lat: 35.68,  lon: 139.69,  utcOffset: 9 },
    { id: 'yokohama',  name_ja: '横浜',       name_en: 'Yokohama',    lat: 35.44,  lon: 139.64,  utcOffset: 9 },
    { id: 'niigata',   name_ja: '新潟',       name_en: 'Niigata',     lat: 37.92,  lon: 139.06,  utcOffset: 9 },
    { id: 'toyama',    name_ja: '富山',       name_en: 'Toyama',      lat: 36.70,  lon: 137.21,  utcOffset: 9 },
    { id: 'kanazawa',  name_ja: '金沢',       name_en: 'Kanazawa',    lat: 36.56,  lon: 136.66,  utcOffset: 9 },
    { id: 'fukui',     name_ja: '福井',       name_en: 'Fukui',       lat: 36.07,  lon: 136.22,  utcOffset: 9 },
    { id: 'kofu',      name_ja: '甲府',       name_en: 'Kofu',        lat: 35.66,  lon: 138.57,  utcOffset: 9 },
    { id: 'nagano',    name_ja: '長野',       name_en: 'Nagano',      lat: 36.65,  lon: 138.18,  utcOffset: 9 },
    { id: 'gifu',      name_ja: '岐阜',       name_en: 'Gifu',        lat: 35.42,  lon: 136.76,  utcOffset: 9 },
    { id: 'shizuoka',  name_ja: '静岡',       name_en: 'Shizuoka',    lat: 34.98,  lon: 138.38,  utcOffset: 9 },
    { id: 'nagoya',    name_ja: '名古屋',     name_en: 'Nagoya',      lat: 35.18,  lon: 136.91,  utcOffset: 9 },
    { id: 'tsu',       name_ja: '津',         name_en: 'Tsu',         lat: 34.72,  lon: 136.51,  utcOffset: 9 },
    { id: 'otsu',      name_ja: '大津',       name_en: 'Otsu',        lat: 35.02,  lon: 135.85,  utcOffset: 9 },
    { id: 'kyoto',     name_ja: '京都',       name_en: 'Kyoto',       lat: 35.01,  lon: 135.77,  utcOffset: 9 },
    { id: 'osaka',     name_ja: '大阪',       name_en: 'Osaka',       lat: 34.69,  lon: 135.50,  utcOffset: 9 },
    { id: 'kobe',      name_ja: '神戸',       name_en: 'Kobe',        lat: 34.69,  lon: 135.20,  utcOffset: 9 },
    { id: 'nara',      name_ja: '奈良',       name_en: 'Nara',        lat: 34.69,  lon: 135.80,  utcOffset: 9 },
    { id: 'wakayama',  name_ja: '和歌山',     name_en: 'Wakayama',    lat: 34.23,  lon: 135.17,  utcOffset: 9 },
    { id: 'tottori',   name_ja: '鳥取',       name_en: 'Tottori',     lat: 35.50,  lon: 134.24,  utcOffset: 9 },
    { id: 'matsue',    name_ja: '松江',       name_en: 'Matsue',      lat: 35.47,  lon: 133.05,  utcOffset: 9 },
    { id: 'okayama',   name_ja: '岡山',       name_en: 'Okayama',     lat: 34.66,  lon: 133.92,  utcOffset: 9 },
    { id: 'hiroshima', name_ja: '広島',       name_en: 'Hiroshima',   lat: 34.39,  lon: 132.46,  utcOffset: 9 },
    { id: 'yamaguchi', name_ja: '山口',       name_en: 'Yamaguchi',   lat: 34.19,  lon: 131.47,  utcOffset: 9 },
    { id: 'tokushima', name_ja: '徳島',       name_en: 'Tokushima',   lat: 34.07,  lon: 134.56,  utcOffset: 9 },
    { id: 'takamatsu', name_ja: '高松',       name_en: 'Takamatsu',   lat: 34.34,  lon: 134.04,  utcOffset: 9 },
    { id: 'matsuyama', name_ja: '松山',       name_en: 'Matsuyama',   lat: 33.84,  lon: 132.77,  utcOffset: 9 },
    { id: 'kochi',     name_ja: '高知',       name_en: 'Kochi',       lat: 33.55,  lon: 133.53,  utcOffset: 9 },
    { id: 'fukuoka',   name_ja: '福岡',       name_en: 'Fukuoka',     lat: 33.59,  lon: 130.40,  utcOffset: 9 },
    { id: 'saga',      name_ja: '佐賀',       name_en: 'Saga',        lat: 33.26,  lon: 130.30,  utcOffset: 9 },
    { id: 'nagasaki',  name_ja: '長崎',       name_en: 'Nagasaki',    lat: 32.75,  lon: 129.87,  utcOffset: 9 },
    { id: 'kumamoto',  name_ja: '熊本',       name_en: 'Kumamoto',    lat: 32.79,  lon: 130.74,  utcOffset: 9 },
    { id: 'oita',      name_ja: '大分',       name_en: 'Oita',        lat: 33.24,  lon: 131.67,  utcOffset: 9 },
    { id: 'miyazaki',  name_ja: '宮崎',       name_en: 'Miyazaki',    lat: 31.91,  lon: 131.42,  utcOffset: 9 },
    { id: 'kagoshima', name_ja: '鹿児島',     name_en: 'Kagoshima',   lat: 31.59,  lon: 130.56,  utcOffset: 9 },
    { id: 'naha',      name_ja: '那覇',       name_en: 'Naha',        lat: 26.21,  lon: 127.68,  utcOffset: 9 },
    /* Japan — designated cities that are not prefectural capitals */
    { id: 'kitakyushu', name_ja: '北九州',    name_en: 'Kitakyushu',  lat: 33.88,  lon: 130.87,  utcOffset: 9 },
    { id: 'kawasaki',  name_ja: '川崎',       name_en: 'Kawasaki',    lat: 35.53,  lon: 139.70,  utcOffset: 9 },
    { id: 'sagamihara', name_ja: '相模原',    name_en: 'Sagamihara',  lat: 35.57,  lon: 139.37,  utcOffset: 9 },
    { id: 'hamamatsu', name_ja: '浜松',       name_en: 'Hamamatsu',   lat: 34.71,  lon: 137.73,  utcOffset: 9 },
    { id: 'sakai',     name_ja: '堺',         name_en: 'Sakai',       lat: 34.57,  lon: 135.48,  utcOffset: 9 },
    /* Overseas — a few major cities; anything else by direct lat/lon */
    { id: 'seoul',     name_ja: 'ソウル',     name_en: 'Seoul',       lat: 37.57,  lon: 126.98,  utcOffset: 9 },
    { id: 'taipei',    name_ja: '台北',       name_en: 'Taipei',      lat: 25.03,  lon: 121.56,  utcOffset: 8 },
    { id: 'singapore', name_ja: 'シンガポール', name_en: 'Singapore', lat: 1.35,   lon: 103.82,  utcOffset: 8 },
    { id: 'london',    name_ja: 'ロンドン',   name_en: 'London',      lat: 51.51,  lon: -0.13,   utcOffset: 0 },
    { id: 'paris',     name_ja: 'パリ',       name_en: 'Paris',       lat: 48.86,  lon: 2.35,    utcOffset: 1 },
    { id: 'newyork',   name_ja: 'ニューヨーク', name_en: 'New York',  lat: 40.71,  lon: -74.01,  utcOffset: -5 },
    { id: 'losangeles', name_ja: 'ロサンゼルス', name_en: 'Los Angeles', lat: 34.05, lon: -118.24, utcOffset: -8 },
    { id: 'honolulu',  name_ja: 'ホノルル',   name_en: 'Honolulu',    lat: 21.31,  lon: -157.86, utcOffset: -10 },
    { id: 'sydney',    name_ja: 'シドニー',   name_en: 'Sydney',      lat: -33.87, lon: 151.21,  utcOffset: 10 }
  ];

  /** Display label used by the search box / datalist: "大阪（Osaka）". */
  function cityLabel(c) { return c.name_ja + '（' + c.name_en + '）'; }

  /**
   * Resolve a free-text query to a preset city, or null.
   * Accepts the display label, the Japanese name, the English name
   * (case-insensitive), or the city id.
   */
  function findCity(query) {
    if (query == null) return null;
    var q = String(query).trim();
    if (!q) return null;
    var ql = q.toLowerCase();
    for (var i = 0; i < CITIES.length; i++) {
      var c = CITIES[i];
      if (q === c.name_ja || q === cityLabel(c) || q === c.id ||
          ql === c.name_en.toLowerCase()) return c;
    }
    return null;
  }

  /**
   * Validate a latitude / longitude pair for direct entry.
   * Returns null when valid, otherwise a Japanese error message.
   */
  function validateLatLon(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return '緯度と経度を数値で入力してください。';
    }
    if (lat < -90 || lat > 90) return '緯度は -90 〜 90 の範囲で入力してください。';
    if (lon < -180 || lon > 180) return '経度は -180 〜 180 の範囲で入力してください。';
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Birth input -> UTC Date                                           */
  /* birth: { date:'YYYY-MM-DD', time:'HH:MM'|null, timeUnknown:bool, */
  /*          lat, lon, utcOffset }                                    */
  /* When the birth time is unknown we use local noon (planet signs   */
  /* are still meaningful; houses/ASC are not computed by callers).    */
  /* ---------------------------------------------------------------- */
  function birthToUtcDate(birth) {
    var parts = String(birth.date).split('-').map(Number);
    var hh = 12, mm = 0;
    if (!birth.timeUnknown && birth.time) {
      var tp = String(birth.time).split(':').map(Number);
      hh = tp[0]; mm = tp[1] || 0;
    }
    var offset = Number(birth.utcOffset) || 0;
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hh - offset, mm, 0));
  }

  /* ---------------------------------------------------------------- */
  /* Today's Line                                                      */
  /* Built only from Unit 1 general words + astro terms, so a learner  */
  /* who finished Unit 1 can read it. "can feel" keeps the reading    */
  /* non-deterministic (a possibility, not a promise).                 */
  /* ---------------------------------------------------------------- */
  var MOON_MOODS = [
    /* Aries */       { feel_en: 'strong and fast',  ja: '強く、速い気持ち' },
    /* Taurus */      { feel_en: 'calm and slow',    ja: '穏やかで、ゆっくりした気持ち' },
    /* Gemini */      { feel_en: 'light',            ja: '軽やかな気持ち', extra_en: 'You can talk and learn with friends.', extra_ja: '友達と話して、学ぶことができる。' },
    /* Cancer */      { feel_en: 'quiet and calm',   ja: '静かで、穏やかな気持ち' },
    /* Leo */         { feel_en: 'happy and warm',   ja: '幸せで、暖かい気持ち' },
    /* Virgo */       { feel_en: 'calm',             ja: '穏やかな気持ち', extra_en: 'You can work and learn now.', extra_ja: '今は働いて、学ぶことができる。' },
    /* Libra */       { feel_en: 'calm',             ja: '穏やかな気持ち', extra_en: 'You can feel music and love.', extra_ja: '音楽と愛を感じることができる。' },
    /* Scorpio */     { feel_en: 'quiet and strong', ja: '静かで、強い気持ち' },
    /* Sagittarius */ { feel_en: 'happy',            ja: '幸せな気持ち', extra_en: 'You can go and play now.', extra_ja: '今は出かけて、遊ぶことができる。' },
    /* Capricorn */   { feel_en: 'strong',           ja: '強い気持ち', extra_en: 'You can work and win.', extra_ja: '働いて、勝つことができる。' },
    /* Aquarius */    { feel_en: 'light',            ja: '軽やかな気持ち', extra_en: 'You can think and read books.', extra_ja: '考えて、本を読むことができる。' },
    /* Pisces */      { feel_en: 'quiet',            ja: '静かな気持ち', extra_en: 'You can feel music in the night.', extra_ja: '夜に音楽を感じることができる。' }
  ];

  /**
   * @param {string[]} signNamesEn  sign names (StarChart.SIGNS_EN)
   * @param {string[]} signNamesJa  sign names (StarChart.SIGNS_JA)
   * @param {number} moonSignIndex  today's Moon sign index 0-11
   * @param {number|null} natalMoonSignIndex  learner's natal Moon sign, or null
   * @param {number} daySeed  day of month, used to vary the quiz order
   */
  function buildTodaysLine(signNamesEn, signNamesJa, moonSignIndex, natalMoonSignIndex, daySeed) {
    var mood = MOON_MOODS[moonSignIndex];
    var linesEn = [];
    var linesJa = [];
    linesEn.push('The Moon is in ' + signNamesEn[moonSignIndex] + ' now.');
    linesJa.push('月は今、' + signNamesJa[moonSignIndex] + 'にある。');
    linesEn.push('You can feel ' + mood.feel_en + '.');
    linesJa.push('あなたは' + mood.ja + 'になることができる。');
    if (mood.extra_en) {
      linesEn.push(mood.extra_en);
      linesJa.push(mood.extra_ja);
    }
    if (natalMoonSignIndex !== null && natalMoonSignIndex !== undefined) {
      linesEn.push('My Moon is in ' + signNamesEn[natalMoonSignIndex] + '.');
      linesJa.push('私の月は' + signNamesJa[natalMoonSignIndex] + 'にある。');
    }
    // Reading check: pick the mood that matches, against a distractor mood.
    var distractor = MOON_MOODS[(moonSignIndex + 5) % 12];
    var correct = '今日は' + mood.ja + 'になりやすい';
    var wrong = '今日は' + distractor.ja + 'になりやすい';
    var options = (daySeed % 2 === 0) ? [correct, wrong] : [wrong, correct];
    return {
      lines_en: linesEn,
      lines_ja: linesJa,
      ja_summary: linesJa.join(''),
      quiz: {
        prompt_ja: '読み取りチェック：この文の内容と合っているのは？',
        options: options,
        answerIndex: options.indexOf(correct),
        explanation_ja: '今日の月は' + signNamesJa[moonSignIndex] + 'にあり、文では「' + mood.ja + '」に触れています。これは傾向を読むための練習文で、断定するものではありません。'
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Profile reading （基本鑑定）                                       */
  /* A first-person summary built from the learner's own chart:        */
  /*   Sun / Moon  -> full Japanese text + English key line            */
  /*                  (data/readings-core.json)                        */
  /*   ASC         -> short text written for this feature              */
  /*                  (data/readings-profile.json)                     */
  /*   Mercury / Venus / Mars -> one line each (Japanese short line    */
  /*                  from readings-profile.json, English key line     */
  /*                  from readings-core.json)                         */
  /* plus a one-line profile ("I am a Cancer Sun, ...") and a full     */
  /* English summary paragraph in first person, so the learner can     */
  /* practise reading it fluently. In limited mode (birth time         */
  /* unknown) nothing that depends on the ASC is included.             */
  /* ---------------------------------------------------------------- */

  function findReading(readings, planet, signEn) {
    var list = (readings && readings.readings) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].planet === planet && list[i].sign === signEn) return list[i];
    }
    return null;
  }

  function findAscText(profileData, signEn) {
    var list = (profileData && profileData.asc) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].sign === signEn) return list[i];
    }
    return null;
  }

  function findShortJa(profileData, planet, signEn) {
    var list = (profileData && profileData.short) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].planet === planet && list[i].sign === signEn) return list[i].ja;
    }
    return null;
  }

  /** "Your Sun in Cancer may ..." -> "My Sun in Cancer may ..." (also you->I, your->my). */
  function toFirstPerson(en) {
    return String(en)
      .replace(/\bYour\b/g, 'My')
      .replace(/\byour\b/g, 'my')
      .replace(/\bYou\b/g, 'I')
      .replace(/\byou\b/g, 'I');
  }

  /**
   * @param {Object} chart        StarChart.computeChart result
   * @param {Object} readingsCore parsed data/readings-core.json
   * @param {Object} profileData  parsed data/readings-profile.json
   * @param {boolean} limited     true when the birth time is unknown
   * @returns {Object|null} null when a needed reading text is missing
   */
  function buildProfileReading(chart, readingsCore, profileData, limited) {
    if (!chart || !chart.planets) return null;
    var sun = chart.planets.Sun.sign;
    var moon = chart.planets.Moon.sign;
    var asc = limited ? null : chart.asc.sign;

    var sunR = findReading(readingsCore, 'Sun', sun.en);
    var moonR = findReading(readingsCore, 'Moon', moon.en);
    if (!sunR || !moonR) return null;

    var sections = [];
    sections.push({ key: 'sun', planet: 'Sun', signEn: sun.en, signJa: sun.ja, ja: sunR.ja, en: sunR.en });
    sections.push({ key: 'moon', planet: 'Moon', signEn: moon.en, signJa: moon.ja, ja: moonR.ja, en: moonR.en });

    var ascT = null;
    if (asc) {
      ascT = findAscText(profileData, asc.en);
      if (!ascT) return null;
      sections.push({ key: 'asc', planet: 'Ascendant', signEn: asc.en, signJa: asc.ja, ja: ascT.ja, en: ascT.en });
    }

    var trio = ['Mercury', 'Venus', 'Mars'];
    for (var i = 0; i < trio.length; i++) {
      var planet = trio[i];
      var sign = chart.planets[planet].sign;
      var r = findReading(readingsCore, planet, sign.en);
      var shortJa = findShortJa(profileData, planet, sign.en);
      if (!r || !shortJa) return null;
      sections.push({ key: planet.toLowerCase(), planet: planet, signEn: sign.en, signJa: sign.ja, ja: shortJa, en: r.en });
    }

    var profileLine = {
      en: 'I am a ' + sun.en + ' Sun, ' + moon.en + ' Moon' + (asc ? ', ' + asc.en + ' rising.' : '.'),
      ja: '太陽は' + sun.ja + '、月は' + moon.ja + (asc ? '、アセンダントは' + asc.ja + 'です。' : 'です。')
    };

    var summaryEnParts = [profileLine.en];
    sections.forEach(function (s) { summaryEnParts.push(toFirstPerson(s.en)); });

    var summaryJaParts = [profileLine.ja];
    summaryJaParts.push(findShortJa(profileData, 'Sun', sun.en));
    summaryJaParts.push(findShortJa(profileData, 'Moon', moon.en));
    if (ascT) summaryJaParts.push(ascT.ja);
    trio.forEach(function (planet) {
      summaryJaParts.push(findShortJa(profileData, planet, chart.planets[planet].sign.en));
    });
    if (summaryJaParts.some(function (p) { return !p; })) return null;

    return {
      limited: !!limited,
      profileLine: profileLine,
      sections: sections,
      summary: {
        en: summaryEnParts.join(' '),
        ja: summaryJaParts.join('')
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Progress                                                          */
  /* ---------------------------------------------------------------- */
  var TOTAL_GENERAL_WORDS = 1500; // Globish target (CURRICULUM.md)

  /**
   * Words/terms mastered = union of newWords/newTerms of completed lessons.
   * @param {Object} unitData  parsed unit1.json shape ({ lessons: [...] })
   * @param {Object} completed  map lessonId -> true
   */
  function masteredSets(unitData, completed) {
    var words = {};
    var terms = {};
    (unitData.lessons || []).forEach(function (lesson) {
      if (!completed[lesson.id]) return;
      (lesson.newWords || []).forEach(function (w) { words[w.en] = true; });
      (lesson.newTerms || []).forEach(function (t) { terms[t.en] = true; });
    });
    return {
      words: Object.keys(words).sort(),
      terms: Object.keys(terms).sort()
    };
  }

  /** A reorder answer matches when tiles joined equal the target sentence. */
  function normalizeSentence(s) {
    return String(s).toLowerCase().replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();
  }
  function checkReorder(selectedTiles, answerEn) {
    return normalizeSentence(selectedTiles.join(' ')) === normalizeSentence(answerEn);
  }

  return {
    CITIES: CITIES,
    cityLabel: cityLabel,
    findCity: findCity,
    validateLatLon: validateLatLon,
    birthToUtcDate: birthToUtcDate,
    buildTodaysLine: buildTodaysLine,
    buildProfileReading: buildProfileReading,
    toFirstPerson: toFirstPerson,
    masteredSets: masteredSets,
    checkReorder: checkReorder,
    normalizeSentence: normalizeSentence,
    TOTAL_GENERAL_WORDS: TOTAL_GENERAL_WORDS
  };
});
