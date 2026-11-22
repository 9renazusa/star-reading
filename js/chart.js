/*
 * STAR READING - chart calculation core
 *
 * Planet longitudes: Astronomy Engine (MIT License, (c) Don Cross)
 *   vendor/astronomy-engine.js / vendor/LICENSE-astronomy-engine.txt
 * Houses: self-implemented Placidus (iterative semi-arc division).
 *
 * Works in the browser (window.StarChart, requires window.Astronomy)
 * and in Node.js (module.exports, requires ../vendor/astronomy-engine.js).
 */
(function (root, factory) {
  var Astronomy;
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    Astronomy = require('../vendor/astronomy-engine.js');
  } else {
    Astronomy = root.Astronomy;
  }
  var api = factory(Astronomy);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.StarChart = api;
})(typeof self !== 'undefined' ? self : this, function (Astronomy) {
  'use strict';

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function norm360(x) {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }

  function norm180(x) {
    x = norm360(x);
    return x > 180 ? x - 360 : x;
  }

  /* ------------------------------------------------------------------ */
  /* Planet longitudes (geocentric, tropical, true equinox of date)      */
  /* ------------------------------------------------------------------ */

  var PLANETS = [
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
    'Uranus', 'Neptune', 'Pluto'
  ];

  /**
   * Ecliptic longitudes (degrees, 0-360) of the 10 astrological planets.
   * @param {Date} date  UTC instant
   * @returns {Object} { Sun, Moon, Mercury, ..., Pluto }
   */
  function planetLongitudes(date) {
    var result = {};
    // Sun: apparent geocentric ecliptic coordinates of date.
    result.Sun = norm360(Astronomy.SunPosition(date).elon);
    // Moon: geocentric ecliptic coordinates of date.
    result.Moon = norm360(Astronomy.EclipticGeoMoon(date).lon);
    // Planets: geocentric vector (with aberration correction) -> ecliptic of date.
    for (var i = 0; i < PLANETS.length; i++) {
      var name = PLANETS[i];
      var vec = Astronomy.GeoVector(Astronomy.Body[name], date, true);
      result[name] = norm360(Astronomy.Ecliptic(vec).elon);
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Angles and Placidus houses                                          */
  /* ------------------------------------------------------------------ */

  // Ecliptic longitude -> declination (degrees)
  function declinationOf(lonDeg, epsDeg) {
    return Math.asin(Math.sin(epsDeg * DEG) * Math.sin(lonDeg * DEG)) * RAD;
  }

  // Right ascension (degrees) of an ecliptic point with longitude lonDeg.
  function raOf(lonDeg, epsDeg) {
    var lon = lonDeg * DEG;
    var eps = epsDeg * DEG;
    return norm360(Math.atan2(Math.sin(lon) * Math.cos(eps), Math.cos(lon)) * RAD);
  }

  /**
   * One Placidus cusp by fixed-point iteration on its right ascension.
   * The cusp point divides its semi-arc (diurnal or nocturnal) in the
   * ratio num/3 measured from the meridian (for 11/12) or from the
   * anti-meridian side (for 2/3), which is the definition of Placidus.
   *
   * @param {number} ramc   Right ascension of MC, degrees
   * @param {number} lat    Geographic latitude, degrees
   * @param {number} eps    Obliquity, degrees
   * @param {number} kind   '11' | '12' | '2' | '3'
   * @param {number} guessRa Initial RA guess, degrees
   */
  function placidusCusp(ramc, lat, eps, kind, guessRa) {
    var ra = guessRa;
    for (var i = 0; i < 100; i++) {
      // Declination of the ecliptic point whose RA is `ra`.
      var lon = raToEclipticLongitude(ra, eps);
      var dec = declinationOf(lon, eps);
      var ad = Math.asin(
        Math.max(-1, Math.min(1, Math.tan(lat * DEG) * Math.tan(dec * DEG)))
      ) * RAD; // ascensional difference
      var next;
      if (kind === '11') {
        next = ramc + (90 + ad) / 3;
      } else if (kind === '12') {
        next = ramc + 2 * (90 + ad) / 3;
      } else if (kind === '2') {
        next = ramc + 180 - 2 * (90 - ad) / 3;
      } else { // '3'
        next = ramc + 180 - (90 - ad) / 3;
      }
      if (Math.abs(norm180(next - ra)) < 1e-10) {
        ra = next;
        break;
      }
      ra = next;
    }
    var finalLon = raToEclipticLongitude(ra, eps);
    return finalLon;
  }

  // Ecliptic longitude of the point on the ecliptic with the given RA.
  // (The point lies on the ecliptic, so longitude follows from RA and eps:
  //  tan(lon) = tan(ra) / cos(eps), same quadrant as ra.)
  function raToEclipticLongitude(raDeg, epsDeg) {
    var ra = raDeg * DEG;
    var eps = epsDeg * DEG;
    return norm360(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps)) * RAD);
  }

  /**
   * Ascendant, MC and Placidus house cusps.
   * @param {Date} date    UTC instant
   * @param {number} lat   Geographic latitude, degrees (north +)
   * @param {number} lon   Geographic longitude, degrees (east +)
   * @returns {Object} { asc, mc, cusps: [cusp1..cusp12], ramc, lst, eps }
   */
  function computeHouses(date, lat, lon) {
    var time = new Astronomy.AstroTime(date);
    var eps = Astronomy.e_tilt(time).tobl; // true obliquity of date, degrees

    // Local sidereal time -> RAMC (degrees)
    var gmstHours = Astronomy.SiderealTime(time);
    var lstHours = (gmstHours + lon / 15) % 24;
    if (lstHours < 0) lstHours += 24;
    var ramc = norm360(lstHours * 15);

    // MC: ecliptic point whose RA equals RAMC.
    var mc = raToEclipticLongitude(ramc, eps);

    // ASC: ecliptic point on the eastern horizon.
    // Horizon condition gives tan(lon) = -cos(ramc) /
    //   (cos(eps) sin(ramc) + sin(eps) tan(lat)); two solutions 180 deg
    // apart - keep the one whose hour angle is negative (rising).
    var ramcR = ramc * DEG;
    var epsR = eps * DEG;
    var ascCand = norm360(
      Math.atan2(
        -Math.cos(ramcR),
        Math.cos(epsR) * Math.sin(ramcR) + Math.sin(epsR) * Math.tan(lat * DEG)
      ) * RAD
    );
    var hourAngle = norm180(ramc - raOf(ascCand, eps));
    var asc = hourAngle < 0 ? ascCand : norm360(ascCand + 180);

    // Placidus intermediate cusps (iterative).
    var cusp11 = placidusCusp(ramc, lat, eps, '11', ramc + 30);
    var cusp12 = placidusCusp(ramc, lat, eps, '12', ramc + 60);
    var cusp2 = placidusCusp(ramc, lat, eps, '2', ramc + 120);
    var cusp3 = placidusCusp(ramc, lat, eps, '3', ramc + 150);

    var cusps = [
      asc,
      cusp2,
      cusp3,
      norm360(mc + 180), // IC
      norm360(cusp11 + 180),
      norm360(cusp12 + 180),
      norm360(asc + 180), // DSC
      norm360(cusp2 + 180),
      norm360(cusp3 + 180),
      mc,
      cusp11,
      cusp12
    ];

    return {
      asc: asc,
      mc: mc,
      cusps: cusps,
      ramc: ramc,
      lst: lstHours,
      eps: eps
    };
  }

  /* ------------------------------------------------------------------ */
  /* Full chart                                                          */
  /* ------------------------------------------------------------------ */

  var SIGNS_EN = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  var SIGNS_JA = [
    '牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座',
    '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座'
  ];

  function signOf(lonDeg) {
    var idx = Math.floor(norm360(lonDeg) / 30);
    return {
      index: idx,
      en: SIGNS_EN[idx],
      ja: SIGNS_JA[idx],
      degreeInSign: norm360(lonDeg) - idx * 30
    };
  }

  /**
   * @param {Date} date    UTC instant of birth
   * @param {number} lat   Birthplace latitude (north +)
   * @param {number} lon   Birthplace longitude (east +)
   */
  function computeChart(date, lat, lon) {
    var longs = planetLongitudes(date);
    var houses = computeHouses(date, lat, lon);
    var planets = {};
    Object.keys(longs).forEach(function (name) {
      planets[name] = { longitude: longs[name], sign: signOf(longs[name]) };
    });
    return {
      planets: planets,
      asc: { longitude: houses.asc, sign: signOf(houses.asc) },
      mc: { longitude: houses.mc, sign: signOf(houses.mc) },
      cusps: houses.cusps.map(function (c) {
        return { longitude: c, sign: signOf(c) };
      }),
      meta: { ramc: houses.ramc, lstHours: houses.lst, obliquity: houses.eps }
    };
  }

  return {
    planetLongitudes: planetLongitudes,
    computeHouses: computeHouses,
    computeChart: computeChart,
    signOf: signOf,
    SIGNS_EN: SIGNS_EN,
    SIGNS_JA: SIGNS_JA
  };
});
