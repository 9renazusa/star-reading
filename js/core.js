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
  /* DST is not modelled; utcOffset is the standard-time offset and    */
  /* can be edited by hand in the form.                                */
  /* ---------------------------------------------------------------- */
  var CITIES = [
    { id: 'chiba',     name_ja: '千葉',       name_en: 'Chiba',       lat: 35.61,  lon: 140.11,  utcOffset: 9 },
    { id: 'tokyo',     name_ja: '東京',       name_en: 'Tokyo',       lat: 35.68,  lon: 139.69,  utcOffset: 9 },
    { id: 'sapporo',   name_ja: '札幌',       name_en: 'Sapporo',     lat: 43.06,  lon: 141.35,  utcOffset: 9 },
    { id: 'sendai',    name_ja: '仙台',       name_en: 'Sendai',      lat: 38.27,  lon: 140.87,  utcOffset: 9 },
    { id: 'nagoya',    name_ja: '名古屋',     name_en: 'Nagoya',      lat: 35.18,  lon: 136.91,  utcOffset: 9 },
    { id: 'kyoto',     name_ja: '京都',       name_en: 'Kyoto',       lat: 35.01,  lon: 135.77,  utcOffset: 9 },
    { id: 'osaka',     name_ja: '大阪',       name_en: 'Osaka',       lat: 34.69,  lon: 135.50,  utcOffset: 9 },
    { id: 'hiroshima', name_ja: '広島',       name_en: 'Hiroshima',   lat: 34.39,  lon: 132.46,  utcOffset: 9 },
    { id: 'fukuoka',   name_ja: '福岡',       name_en: 'Fukuoka',     lat: 33.59,  lon: 130.40,  utcOffset: 9 },
    { id: 'naha',      name_ja: '那覇',       name_en: 'Naha',        lat: 26.21,  lon: 127.68,  utcOffset: 9 },
    { id: 'london',    name_ja: 'ロンドン',   name_en: 'London',      lat: 51.51,  lon: -0.13,   utcOffset: 0 },
    { id: 'newyork',   name_ja: 'ニューヨーク', name_en: 'New York',  lat: 40.71,  lon: -74.01,  utcOffset: -5 },
    { id: 'losangeles', name_ja: 'ロサンゼルス', name_en: 'Los Angeles', lat: 34.05, lon: -118.24, utcOffset: -8 },
    { id: 'sydney',    name_ja: 'シドニー',   name_en: 'Sydney',      lat: -33.87, lon: 151.21,  utcOffset: 10 }
  ];

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
    birthToUtcDate: birthToUtcDate,
    buildTodaysLine: buildTodaysLine,
    masteredSets: masteredSets,
    checkReorder: checkReorder,
    normalizeSentence: normalizeSentence,
    TOTAL_GENERAL_WORDS: TOTAL_GENERAL_WORDS
  };
});
