// global variables
var inputPrompt = 'the quick brown fox jumps over the lazy dog';
var decimalAccuracy = 2;

// stores all measures by category
var m = {
  gen: {
    id: 'general-measures',
    title: 'General',
    measures: {
      transcribed: {
        id: 'transcribed',
        title: 'Transcribed String (T)',
        calculate: function () { return el('input').value; }
      },
      totalTime: {
        id: 'total-time',
        title: 'Total time (S)',
        unit: 's',
        calculate: function () { return (inputStream.lastEvent.timeStamp - inputStream.events[0].timeStamp) / 1000; }
      },
      is: {
        id: 'input-stream',
        title: 'Input Stream (IS)',
        calculate: function () { return inputStream.str },
      }
    },
  },
  speed: {
    id: 'speed-measures',
    title: 'Speed',
    measures: {
      cps: {
        id: 'cps',
        title: 'Characters per Second (CPS)',
        calculate: function () { 
          let length = val('gen.transcribed').length - 1;
          let time = val('gen.totalTime');
          return length / time;
        },
      },
      wpm: {
        id: 'wpm',
        title: 'Words per Minute (WPM)',
        calculate: function () { return val('speed.cps') * 12; }
      },
      gps: {
        id: 'gps',
        title: 'Gestures per Second (GPS)',
        calculate: function () { return (inputStream.events.length - 1) / val('gen.totalTime'); }
      }
    },
  },
  acc: {
    id: 'accuracy-measures',
    title: 'Accuracy',
    measures: {
      gpc: {
        id: 'gpc',
        title: 'Gestures per Character (GPC)',
        calculate: function () { return inputStream.events.length / val('gen.transcribed').length; }
      },
      msd: {
        id: 'msd',
        title: 'Minimum String Distance (MSD)',
        calculate: function () { return msd(inputPrompt, val('gen.transcribed')); }
      },
      cer: {
        id: 'cer',
        title: 'Corrected Error Rate',
        calculate: function () { return calculateErrorRates().corrected; }
      },
      uer: {
        id: 'uer',
        title: 'Uncorrected Error Rate',
        calculate: function () { return calculateErrorRates().uncorrected; }
      },
      ter: {
        id: 'ter',
        title: 'Total Error Rate',
        calculate: function () { return calculateErrorRates().total; }
      }
    },
  },
  eff: {
    id: 'efficiency-measures',
    title: 'Efficiency',
    measures: {
      pc: {
        id: 'pc',
        title: 'Participant Conscientiousness (PC)',
        calculate: function () {
          var { C, IF, INF, F } = calculateErrorClasses();
          return IF / (IF + INF);
        },
      },
      ubw: {
        id: 'ubw',
        title: 'Utilized Bandwidth',
        calculate: function () {
          var { C, IF, INF, F } = calculateErrorClasses();
          return C / (C + INF + IF + F);
        },
      },
      wbw: {
        id: 'wbw',
        title: 'Wasted Bandwidth',
        calculate: function () {
          var { C, IF, INF, F } = calculateErrorClasses();
          return (INF + IF + F) / (C + INF + IF + F);
        },
      },
      // cpc: {
      //   id: 'cpc',
      //   title: 'Cost per Correction (CPC)',
      //   calculate: function () {
      //     var { C, IF, INF, F } = calculateErrorClasses();
      //     var noOfBlocks = (calculateInputStream().match(/(<)+/g) || []).length;
      //     return (noOfBlocks > 0) ? (IF + F) / noOfBlocks : '-';
      //   }
      // }
    },
  },
};

// helper functions

// returns the DOM element with the specified ID.
function el(id) {
  return document.getElementById(id);
}

// Invokes the callback function for each of an object's property, passing the property's value, key and the original object.
function iter(obj, callback) {
  Object.keys(obj).forEach(function (key) { return callback(obj[key], key, obj); });
}

// Invokes the callback function for each measure, passing the measure object, ID and the category object, ID.
function forEachMeasure(callback) {
  iter(m, function (category) {
    iter(category.measures, function (measure) {
      return callback(measure, measure.id, category, category.id);
    });
  });
}

// Rounds a number based on the specified decimal accuracy.
function round(value) {
  var pow = Math.pow(10, decimalAccuracy);
  return Math.round(value * pow) / pow;
}

// Returns the calculated value for a measure, abbreviated by "category:measure".
function val(id) {
  var arr = id.split('.');
  return m[arr[0]].measures[arr[1]].calculate();
}

// visualization

// Builds the initial site content based on the defined measures.
// Hides measure if it is listed in `hide` array.
function renderInitial(hide) {
  var html = '';
  iter(m, function (category) {
    var hideCategory = hide? (hide.indexOf(category.id) > -1) : false;    
    html += `
      <section id="${category.id}" class="container measure-container" ${hideCategory? 'style="display: none;"' : ''}>
        <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>${category.title} Measures</th>
            <th>Value</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
      `;
      iter(category.measures, function (measure) {
        var hideMeasure = hide? (hide.indexOf(measure.id) > -1) : false;
        html += `
          <tr id="${measure.id}" ${hideMeasure? 'style="display:none;"' : ''}>
            <td>${measure.title}</td>
            <td id="${measure.id}-value">-</td>
            <td id="${measure.id}-info"></td>
          </tr>
        `
      });
      html += `</tbody></table></section>`;
  });
  el('content').innerHTML = html;

  // attach popovers
  forEachMeasure(function (measure, mId, category) {
    var popup = el(measure.id + '-popup');
    var cell = el(measure.id + '-info');
    if (!popup) {
      cell.innerHTML = '';
      return;
    }
    var subtitle = '' +
        (measure.methodSpecific? 'Method-Specific' : 'Method-Agnostic') + ' ' + 
        (measure.characterLevel? 'Character-Level' : 'Aggregate') + ' ' +
        category.title + ' Measure';

    cell.innerHTML = `
      <div class="popover popover-left">
        <span class="measure-info-icon">🛈</span>
        <div class="popover-container">
          <div class="card">
            <div class="card-header">
              <h4 class="card-title">${measure.title}</h4>
              <h6 class="card-subtitle">${subtitle}</h6>
            </div>
            <div id="${measure.id}-info-body" class="card-body"></div>
          </div>
        </div>
      </div>
    `;
    el(measure.id + '-info-body').appendChild(el(measure.id + '-popup'));
  });
}

// Updates the measure values.
function renderUpdate() {
  return forEachMeasure(displayMeasureValue);
}

// Displays a single measure's value, using rounding if the value is a number.
function displayMeasureValue(measure) {
  var value = measure.calculate();
  if (!isNaN(value))
    value = round(value);

  el(measure.id + '-value').innerText = value + (measure.unit? ' ' + measure.unit : '');
}

// Resets all values.
function reset() {
  var input = el('input');
  input.value = '';
  input.focus();
  inputStream.events = [];
  inputStream.lastEvent = null;
  inputStream.str = '';

  forEachMeasure(function (measure) { el(measure.id + '-value').innerText = '-'; });
}

function registerEvent(event) {
  events.push(event);
}

function calculateErrorClasses() {
  var INF = msd(inputPrompt, val('gen.transcribed'));
  var C = Math.max(inputPrompt.length, val('gen.transcribed').length) - INF;
  var corrections = inputStream.events.filter((e) => e.correction);
  var F = corrections.length;
  var IF = corrections.map((e) => e.diff.length)
                      .reduce((prev, current) => prev + current, 0);
  return { C, IF, INF, F };
}

function calculateErrorRates() {
  var { C, IF, INF, F } = calculateErrorClasses();
  var denom = C + INF + IF;

  return {
    corrected: IF / denom,
    uncorrected: INF / denom,
    total: (IF + INF) / denom,
  }
}

// Display
function displayInput(input) {
  el('input').value = input;
}

function displayInputPrompt() {
  el('input-prompt').innerText = inputPrompt;
}

window.onload = function () {
  var queryParams = getQueryParameters();

  if (queryParams.prompt)
    inputPrompt = queryParams.prompt;
  displayInputPrompt();

  // hide selected UI elements
  var hide = [];

  if (queryParams.hide)
    hide = queryParams.hide.split(',');

  if (queryParams.show) {
    var arr = queryParams.show.split(',');
    var categories = [];
    iter(m, function (cat) { categories.push(cat.id) });
    forEachMeasure(function (measure, mID, category) {
      if (!(arr.indexOf(measure.id) > -1)) {
        hide.push(measure.id);
      } else {
        categories.splice(categories.indexOf(category.id), 1);
      }
    });
    hide = hide.concat(categories);
  }

  renderInitial(hide);
  el('input').oninput = onInputChange;
  el('resetBtn').onclick = reset;

  reset();

  if (queryParams.decimalAccuracy)
    decimalAccuracy = queryParams.decimalAccuracy;

  if (queryParams.write)
    simulateWrite(queryParams.write, queryParams.delay ? queryParams.delay : 500);
}

function simulateWrite(str, delay) {
  var input = el('input');

  var inputs = [];
  while (str !== '') {
    if (str[0] !== inputStream.Representation.Group.Begin) {
      inputs.push(str[0]);
      str = str.substring(1);
    } else {
      var endIndex = str.indexOf(inputStream.Representation.Group.End);
      inputs.push(str.substring(1, endIndex));
      str = str.substring(endIndex + 1);
    }
  }

  function delayedAppend(str, delay) {
    setTimeout(function () {
      appendToInput(str);
    }, delay);
  }
  for (var i = 0; i < inputs.length; i++)
    delayedAppend(inputs[i], i * delay);
}

function appendToInput(str) {
  if (str[0] === inputStream.Representation.Backspace)
    input.value = input.value.substring(0, input.value.length - str.length);
  else
    input.value += str;

  input.dispatchEvent(new Event('input'));
}

var inputStream = {
  Representation: {
    Backspace: '<',
    Group: {
      Begin: '[',
      End: ']',
    },
  },
  events: [],
  lastEvent: null,
  str: '',
};

function onInputChange(event) {
  var input = el('input');
  var next = input.value;
  var prev = '';
  if (inputStream.lastEvent)
    prev = inputStream.lastEvent.data;

  var event = {
    timeStamp: Date.now(),
    data: next,
    correction: prev.length > next.length,
  }
  if (next.length > prev.length) {
    event.diff = next.substring(next.indexOf(prev) + prev.length);
  } else {
    event.diff = inputStream.Representation.Backspace.repeat(prev.length - next.length);
  }
  event.multi = event.diff.length > 1;
  inputStream.events.push(event);
  inputStream.lastEvent = event;

  inputStream.str += event.multi? `[${event.diff}]` : event.diff;

  renderUpdate();
}

// see http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getQueryParameters() {
  var match,
    pl = /\+/g,  // Regex for replacing addition symbol with a space
    search = /([^&=]+)=?([^&]*)/g,
    decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
    query = window.location.search.substring(1);

  var params = {};
  while (match = search.exec(query))
    params[decode(match[1])] = decode(match[2]);

  return params;
}

/** MSD calculation obtained from https://github.com/gustf/js-levenshtein (MIT license) */
function _min(d0, d1, d2, bx, ay)
{
  return d0 < d1 || d2 < d1
      ? d0 > d2
          ? d2 + 1
          : d0 + 1
      : bx === ay
          ? d1
          : d1 + 1;
}

function msd(a, b)
{
  if (a === b) {
    return 0;
  }

  if (a.length > b.length) {
    var tmp = a;
    a = b;
    b = tmp;
  }

  var la = a.length;
  var lb = b.length;

  while (la > 0 && (a.charCodeAt(la - 1) === b.charCodeAt(lb - 1))) {
    la--;
    lb--;
  }

  var offset = 0;

  while (offset < la && (a.charCodeAt(offset) === b.charCodeAt(offset))) {
    offset++;
  }

  la -= offset;
  lb -= offset;

  if (la === 0 || lb === 1) {
    return lb;
  }

  var x;
  var y;
  var d0;
  var d1;
  var d2;
  var d3;
  var dd;
  var dy;
  var ay;
  var bx0;
  var bx1;
  var bx2;
  var bx3;

  var vector = new Array(la << 1);

  bx0 = b.charCodeAt(offset);
  dd = 1;
  for (y = 0; y < la; y++) {
    vector[la + y] = a.charCodeAt(offset + y);
    vector[y] = dd = dd < y ? dd + 1 : bx0 === vector[la + y] ? y : y + 1;
  }

  for (x = 1; (x + 3) < lb;) {
    bx0 = b.charCodeAt(offset + (d0 = x));
    bx1 = b.charCodeAt(offset + (d1 = x + 1));
    bx2 = b.charCodeAt(offset + (d2 = x + 2));
    bx3 = b.charCodeAt(offset + (d3 = x + 3));
    dd = (x += 4);
    for (y = 0; y < la;) {
      ay = vector[la + y];
      dy = vector[y];
      d0 = _min(dy, d0, d1, bx0, ay);
      d1 = _min(d0, d1, d2, bx1, ay);
      d2 = _min(d1, d2, d3, bx2, ay);
      dd = _min(d2, d3, dd, bx3, ay);
      vector[y++] = dd;
      d3 = d2;
      d2 = d1;
      d1 = d0;
      d0 = dy;
    }
  }

  for (; x < lb;) {
    bx0 = b.charCodeAt(offset + (d0 = x));
    dd = ++x;
    for (y = 0; y < la; y++) {
      dy = vector[y];
      vector[y] = dd = dy < d0 || dd < d0
          ? dy > dd ? dd + 1 : dy + 1
          : bx0 === vector[la + y]
              ? d0
              : d0 + 1;
      d0 = dy;
    }
  }

  return dd;
};