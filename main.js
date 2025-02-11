const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB'
}).addTo(map);

const ScoresFiles = [
  { year: '2024', path: 'https://AmFa6.github.io/TAF_test/2024_connectscore.geojson' },
  { year: '2023', path: 'https://AmFa6.github.io/TAF_test/2023_connectscore.geojson' },
  { year: '2022', path: 'https://AmFa6.github.io/TAF_test/2022_connectscore.geojson' },
  { year: '2019', path: 'https://AmFa6.github.io/TAF_test/2019_connectscore.geojson' },
  { year: '2023-2024', path: 'https://AmFa6.github.io/TAF_test/2023-2024_connectscore.geojson' },
  { year: '2019-2024', path: 'https://AmFa6.github.io/TAF_test/2019-2024_connectscore.geojson' },
  { year: '2022-2023', path: 'https://AmFa6.github.io/TAF_test/2022-2023_connectscore.geojson' },
  { year: '2019-2023', path: 'https://AmFa6.github.io/TAF_test/2019-2023_connectscore.geojson' }, 
  { year: '2019-2022', path: 'https://AmFa6.github.io/TAF_test/2019-2022_connectscore.geojson' }
];

const layers = {};
const totalLayers = ScoresFiles.length;
const ScoresYear = document.getElementById("yearScoresDropdown");
const ScoresPurpose = document.getElementById("purposeScoresDropdown");
const ScoresMode = document.getElementById("modeScoresDropdown");
const ScoresOpacity = document.getElementById("opacityFieldScoresDropdown");
const ScoresOutline = document.getElementById("outlineFieldScoresDropdown");
const ScoresInverseOpacity = document.getElementById("inverseOpacityScaleScoresButton");
const ScoresInverseOutline = document.getElementById("inverseOutlineScaleScoresButton");
const AmenitiesYear = document.getElementById("yearAmenitiesDropdown");
const AmenitiesMode = document.getElementById("modeAmenitiesDropdown");
const AmenitiesPurpose = document.querySelectorAll('.checkbox-label input[type="checkbox"]');
const AmenitiesOpacity = document.getElementById("opacityFieldAmenitiesDropdown");
const AmenitiesOutline = document.getElementById("outlineFieldAmenitiesDropdown");
const AmenitiesInverseOpacity = document.getElementById("inverseOpacityScaleAmenitiesButton");
const AmenitiesInverseOutline = document.getElementById("inverseOutlineScaleAmenitiesButton");

ScoresFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(ScoresLayer => {
      layers[file.year] = ScoresLayer;
      layersLoaded++;
      if (layersLoaded === totalLayers) {
        initializeScoresSliders();
      }
    })
});

ScoresYear.value = "";
ScoresOpacity.value = "None";
ScoresOutline.value = "None";
AmenitiesOpacity.value = "None";
AmenitiesOutline.value = "None";

let autoUpdateOpacity = true;
let autoUpdateOutline = true;
let opacityScoresOrder = 'low-to-high';
let outlineScoresOrder = 'low-to-high';
let opacityAmenitiesOrder = 'low-to-high';
let outlineAmenitiesOrder = 'low-to-high';
let layersLoaded = 0;
let ScoresOpacityRange;
let ScoresOutlineRange;
let AmenitiesOpacityRange;
let AmenitiesOutlineRange;
let isInverseScoresOpacity = false;
let isInverseScoresOutline = false;
let isInverseAmenitiesOpacity = false;
let isInverseAmenitiesOutline = false;
let currentAmenitiesCatchmentLayer = null;
let hexTimeMap = {};
let csvDataCache = {};

initializeAmenitiesSliders()

ScoresYear.addEventListener("change", updateScoresLayer)
ScoresPurpose.addEventListener("change", updateScoresLayer);
ScoresMode.addEventListener("change", updateScoresLayer);
AmenitiesYear.addEventListener("change", updateAmenitiesLayer);
AmenitiesMode.addEventListener("change", updateAmenitiesLayer);
AmenitiesPurpose.forEach(checkbox => {
  checkbox.addEventListener("change", updateAmenitiesLayer);
});
ScoresOpacity.addEventListener("change", () => {
  autoUpdateOpacity = true;
  updateOpacitySliderScoresRanges();
  updateScoresLayer();
});
ScoresOutline.addEventListener("change", () => {
  autoUpdateOutline = true;
  updateOutlineSliderScoresRanges();
  updateScoresLayer();
});
AmenitiesOpacity.addEventListener("change", () => {
  autoUpdateOpacity = true;
  updateOpacitySliderAmenitiesRanges();
  updateAmenitiesLayer();
});
AmenitiesOutline.addEventListener("change", () => {
  autoUpdateOutline = true;
  updateOutlineSliderAmenitiesRanges();
  updateAmenitiesLayer();
});
ScoresInverseOpacity.addEventListener("click", toggleInverseOpacityScoresScale);
ScoresInverseOutline.addEventListener("click", toggleInverseOutlineScoresScale);
AmenitiesInverseOpacity.addEventListener("click", toggleInverseOpacityAmenitiesScale);
AmenitiesInverseOutline.addEventListener("click", toggleInverseOutlineAmenitiesScale);

function initializeSliders(sliderElement, updateCallback) {
  if (sliderElement.noUiSlider) {
    return;
  }

  noUiSlider.create(sliderElement, {
    start: [0, 0],
    connect: [true, true, true],
    range: {
      'min': 0,
      'max': 0
    },
    step: 1,
    tooltips: false,
    format: {
      to: value => parseFloat(value).toFixed(2),
      from: value => parseFloat(value)
    }
  });

  const handles = sliderElement.querySelectorAll('.noUi-handle');
  if (handles.length > 0) {
    handles[0].classList.add('noUi-handle-transparent');
  }

  const connectElements = sliderElement.querySelectorAll('.noUi-connect');
  if (connectElements.length > 2) {
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  sliderElement.noUiSlider.on('update', updateCallback);

  sliderElement.noUiSlider.on('update', function(values, handle) {
    const handleElement = handles[handle];
    handleElement.setAttribute('data-value', formatValue(values[handle], sliderElement.noUiSlider.options.step));
  });
}

function styleScoresFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacityValue, maxOpacityValue, minOutlineValue, maxOutlineValue, selectedYear) {
  const value = feature.properties[fieldToDisplay];
  const color = getColor(value, selectedYear);

  let opacity;
  if (opacityField === 'None') {
    opacity = 0.8;
  } else {
    const opacityValue = feature.properties[opacityField];
    if (opacityValue === 0 || opacityValue === null || opacityValue === undefined || opacityValue === '') {
      opacity = 0.1;
    } else {
      opacity = scaleExp(opacityValue, minOpacityValue, maxOpacityValue, 0.1, 0.8, opacityScoresOrder);
    }
  }

  let weight;
  if (outlineField === 'None') {
    weight = 0;
  } else {
    const outlineValue = feature.properties[outlineField];
    if (outlineValue === 0 || outlineValue === null || outlineValue === undefined || outlineValue === '') {
      weight = 0;
    } else {
      weight = scaleExp(outlineValue, minOutlineValue, maxOutlineValue, 0, 4, outlineScoresOrder);
    }
  }

  return {
    fillColor: color,
    weight: weight,
    opacity: 1,
    color: 'black',
    fillOpacity: opacity
  };
}

function scaleExp(value, minVal, maxVal, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = order === 'low-to-high' ? normalizedValue : 1 - normalizedValue;
  return minScale + scaledValue * (maxScale - minScale);
}

function formatValue(value, step) {
  if (step >= 1) {
    return parseFloat(value).toFixed(0);
  } else if (step >= 0.1) {
    return parseFloat(value).toFixed(1);
  } else if (step >= 0.01) {
    return parseFloat(value).toFixed(2);
  } else {
    return value.toString();
  }
}

function onEachFeature(feature, layer, selectedYear, selectedPurpose, selectedMode) {
  layer.on({
    click: function (e) {
      const properties = feature.properties;
      const getValue = (prop) => (properties[prop] !== undefined && properties[prop] !== null) ? properties[prop] : '-';
      const hexId = getValue('Hex_ID');
      const scoreValue = getValue(`${selectedPurpose}_${selectedMode}`);
      let score = '-';
      let scoreLabel = 'Score';

      if (scoreValue !== '-') {
        if (selectedYear.includes('-')) {
          score = Math.round(scoreValue * 100) + '%';
          scoreLabel = 'Score Difference';
        } else {
          score = Math.round(scoreValue);
        }
      }

      const percentile = getValue(`${selectedPurpose}_${selectedMode}_100`) !== '-' ? Math.round(getValue(`${selectedPurpose}_${selectedMode}_100`)) : '-';
      const population = getValue('pop') !== '-' ? Math.round(getValue('pop')) : '-';
      const imd = population === 0 ? '-' : (getValue('imd') !== '-' ? getValue('imd').toFixed(2) : '-');
      const carAvailability = population === 0 ? '-' : (getValue('carav') !== '-' ? getValue('carav').toFixed(2) : '-');
      const futureDwellings = getValue('hh_fut') === 0 ? '-' : (getValue('hh_fut') !== '-' ? Math.round(getValue('hh_fut')) : '-');

      let popupContent = `<strong>Hex_ID:</strong> ${hexId}<br><strong>${scoreLabel}:</strong> ${score}<br><strong>Percentile:</strong> ${percentile}<br><strong>Population:</strong> ${population}<br><strong>IMD:</strong> ${imd}<br><strong>Car Availability:</strong> ${carAvailability}<br><strong>Future Dwellings:</strong> ${futureDwellings}`;

      L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
    }
  });
}

function getColor(value, selectedYear) {
  if (!selectedYear) {
    return 'transparent';
  }

  if (selectedYear.includes('-')) {
    if (value <= -0.2) {
      return '#FF0000';
    } else if (value > -0.2 && value <= -0.1) {
      return '#FF5500';
    } else if (value > -0.1 && value < 0) {
      return '#FFAA00';
    } else if (value === 0) {
      return 'transparent';
    } else if (value > 0 && value <= 0.1) {
      return '#B0E200';
    } else if (value >= 0.1 && value < 0.2) {
      return '#6EC500';
    } else {
      return '#38A800';
    }
  } else {
    return value > 90 ? '#fde725' :
           value > 80 ? '#b5de2b' :
           value > 70 ? '#6ece58' :
           value > 60 ? '#35b779' :
           value > 50 ? '#1f9e89' :
           value > 40 ? '#26828e' :
           value > 30 ? '#31688e' :
           value > 20 ? '#3e4989' :
           value > 10 ? '#482777' :
                        '#440154';
  }
}

function isClassVisible(value, selectedYear) {
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  for (const checkbox of legendCheckboxes) {
    const range = checkbox.getAttribute('data-range');
    const isChecked = checkbox.checked;

    if (selectedYear.includes('-')) {
      const [min, max] = range.split(' to ').map(parseFloat);
      if (value >= min && value <= max && !isChecked) {
        return false;
      }
    } else {
      if (range.includes('>') && range.includes('<=') && value > parseFloat(range.split('>')[1].split('<=')[0]) && value <= parseFloat(range.split('<=')[1]) && !isChecked) {
        return false;
      } else if (range.includes('>') && !range.includes('<=') && value > parseFloat(range.split('>')[1]) && !isChecked) {
        return false;
      } else if (range.includes('-')) {
        const [min, max] = range.split('-').map(parseFloat);
        if (value >= min && value <= max && !isChecked) {
          return false;
        }
      }
    }
  }
  return true;
}

function updateLegend() {
  const selectedYear = ScoresYear.value;
  const legendContent = document.getElementById("legend-content");

  const checkboxStates = {};
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  legendCheckboxes.forEach(checkbox => {
    checkboxStates[checkbox.getAttribute('data-range')] = checkbox.checked;
  });

  legendContent.innerHTML = '';

  let headerText;
  let classes;

  if (currentAmenitiesCatchmentLayer) {
    headerText = "Journey Time Catchment (minutes)";
    classes = [
      { range: `> 0 and <= 5`, color: "#fde725" },
      { range: `> 5 and <= 10`, color: "#7ad151" },
      { range: `> 10 and <= 15`, color: "#23a884" },
      { range: `> 15 and <= 20`, color: "#2a788e" },
      { range: `> 20 and <= 25`, color: "#414387" },
      { range: `> 25 and <= 30`, color: "#440154" }
    ];
  } else {
    headerText = selectedYear.includes('-') ? "Score Difference" : "Population Percentiles";
    classes = selectedYear.includes('-') ? [
      { range: `<= -20%`, color: "#FF0000" },
      { range: `> -20% and <= -10%`, color: "#FF5500" },
      { range: `> -10% and < 0`, color: "#FFAA00" },
      { range: `= 0`, color: "transparent" },
      { range: `> 0 and <= 10%`, color: "#B0E200" },
      { range: `>= 10% and < 20%`, color: "#6EC500" },
      { range: `>= 20%`, color: "#38A800" }
    ] : [
      { range: `90-100 - 10% of region's population with best access to amenities`, color: "#fde725" },
      { range: `80-90`, color: "#b5de2b" },
      { range: `70-80`, color: "#6ece58" },
      { range: `60-70`, color: "#35b779" },
      { range: `50-60`, color: "#1f9e89" },
      { range: `40-50`, color: "#26828e" },
      { range: `30-40`, color: "#31688e" },
      { range: `20-30`, color: "#3e4989" },
      { range: `10-20`, color: "#482777" },
      { range: `0-10 - 10% of region's population with worst access to amenities`, color: "#440154" }
    ];
  }

  const headerDiv = document.createElement("div");
  headerDiv.innerHTML = `${headerText}`;
  headerDiv.style.fontSize = "1.1em";
  headerDiv.style.marginBottom = "10px";
  legendContent.appendChild(headerDiv);

  const masterCheckboxDiv = document.createElement("div");
  masterCheckboxDiv.innerHTML = `<input type="checkbox" id="masterCheckbox" checked> <i>Select/Deselect All</i>`;
  legendContent.appendChild(masterCheckboxDiv);

  classes.forEach(c => {
    const div = document.createElement("div");
    const isChecked = checkboxStates[c.range] !== undefined ? checkboxStates[c.range] : true;
    div.innerHTML = `<input type="checkbox" class="legend-checkbox" data-range="${c.range}" ${isChecked ? 'checked' : ''}> <span style="display: inline-block; width: 20px; height: 20px; background-color: ${c.color};"></span> ${c.range}`;
    legendContent.appendChild(div);
  });

  const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
  newLegendCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateMasterCheckbox();
      if (currentAmenitiesCatchmentLayer) {
        updateAmenitiesLayer();
      } else {
        updateScoresLayer();
      }
    });
  });

  const masterCheckbox = document.getElementById('masterCheckbox');
  masterCheckbox.addEventListener('change', () => {
    const isChecked = masterCheckbox.checked;
    newLegendCheckboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    if (currentAmenitiesCatchmentLayer) {
      updateAmenitiesLayer();
    } else {
      updateScoresLayer();
    }
  });

  updateMasterCheckbox();
}

function updateMasterCheckbox() {
  const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
  const allChecked = Array.from(newLegendCheckboxes).every(checkbox => checkbox.checked);
  const noneChecked = Array.from(newLegendCheckboxes).every(checkbox => !checkbox.checked);
  const masterCheckbox = document.getElementById('masterCheckbox');
  masterCheckbox.checked = allChecked;
  masterCheckbox.indeterminate = !allChecked && !noneChecked;
}

function initializeScoresSliders() {
  ScoresOpacityRange = document.getElementById('opacityRangeScoresSlider');
  ScoresOutlineRange = document.getElementById('outlineRangeScoresSlider');
  initializeSliders(ScoresOpacityRange, updateScoresLayer);
  initializeSliders(ScoresOutlineRange, updateScoresLayer);
}

function toggleInverseOpacityScoresScale() {
  isInverseScoresOpacity = !isInverseScoresOpacity;
  const handles = ScoresOpacityRange.querySelectorAll('.noUi-handle');
  const connectElements = ScoresOpacityRange.querySelectorAll('.noUi-connect');

  if (isInverseScoresOpacity) {
    ScoresOpacityRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.add('noUi-handle-transparent');
    handles[0].classList.remove('noUi-handle-transparent');
    connectElements[0].classList.add('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-right');
    connectElements[1].classList.add('noUi-connect-gradient-left');
    connectElements[2].classList.remove('noUi-connect-dark-grey');
  } else {
    ScoresOpacityRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.remove('noUi-handle-transparent');
    handles[0].classList.add('noUi-handle-transparent');
    connectElements[0].classList.remove('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-left');
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  opacityScoresOrder = opacityScoresOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';

  updateOpacitySliderScoresRanges();
  updateScoresLayer();
}

function toggleInverseOutlineScoresScale() {
  isInverseScoresOutline = !isInverseScoresOutline;
  const handles = ScoresOutlineRange.querySelectorAll('.noUi-handle');
  const connectElements = ScoresOutlineRange.querySelectorAll('.noUi-connect');

  if (isInverseScoresOutline) {
    ScoresOutlineRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.add('noUi-handle-transparent');
    handles[0].classList.remove('noUi-handle-transparent');
    connectElements[0].classList.add('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-right');
    connectElements[1].classList.add('noUi-connect-gradient-left');
    connectElements[2].classList.remove('noUi-connect-dark-grey');
  } else {
    ScoresOutlineRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.remove('noUi-handle-transparent');
    handles[0].classList.add('noUi-handle-transparent');
    connectElements[0].classList.remove('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-left');
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  outlineScoresOrder = outlineScoresOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';

  updateOutlineSliderScoresRanges();
  updateScoresLayer();
}

function updateOpacitySliderScoresRanges() {
  const opacityField = ScoresOpacity.value;
  const selectedYear = ScoresYear.value;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const opacityValues = opacityField !== "None" ? selectedLayer.features.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0) : [];
    const minOpacity = Math.min(...opacityValues);
    const maxOpacity = Math.max(...opacityValues);
    const roundedMaxOpacity = Math.pow(10, Math.ceil(Math.log10(maxOpacity)));
    let opacityStep = roundedMaxOpacity / 100;

    if (isNaN(opacityStep) || opacityStep <= 0) {
      opacityStep = 1;
    }

    const adjustedMaxOpacity = Math.ceil(maxOpacity / opacityStep) * opacityStep;
    const adjustedMinOpacity = Math.floor(minOpacity / opacityStep) * opacityStep;

    if (opacityField === "None") {
      ScoresOpacityRange.setAttribute('disabled', true);
      ScoresOpacityRange.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      ScoresOpacityRange.noUiSlider.set(['', '']);
      document.getElementById('opacityRangeScoresMin').innerText = '';
      document.getElementById('opacityRangeScoresMax').innerText = '';
    } else {
      ScoresOpacityRange.removeAttribute('disabled');
      ScoresOpacityRange.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOpacity,
          'max': adjustedMaxOpacity
        },
        step: opacityStep
      });
      ScoresOpacityRange.noUiSlider.set([adjustedMinOpacity, adjustedMaxOpacity]);
      document.getElementById('opacityRangeScoresMin').innerText = formatValue(adjustedMinOpacity, opacityStep);
      document.getElementById('opacityRangeScoresMax').innerText = formatValue(adjustedMaxOpacity, opacityStep);
    }
  }
}

function updateOutlineSliderScoresRanges() {
  const outlineField = ScoresOutline.value;
  const selectedYear = ScoresYear.value;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const outlineValues = outlineField !== "None" ? selectedLayer.features.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0) : [];
    const minOutline = Math.min(...outlineValues);
    const maxOutline = Math.max(...outlineValues);
    const roundedMaxOutline = Math.pow(10, Math.ceil(Math.log10(maxOutline)));
    let outlineStep = roundedMaxOutline / 100;

    if (isNaN(outlineStep) || outlineStep <= 0) {
      outlineStep = 1;
    }

    const adjustedMaxOutline = Math.ceil(maxOutline / outlineStep) * outlineStep;
    const adjustedMinOutline = Math.floor(minOutline / outlineStep) * outlineStep;

    if (outlineField === "None") {
      ScoresOutlineRange.setAttribute('disabled', true);
      ScoresOutlineRange.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      ScoresOutlineRange.noUiSlider.set(['', '']);
      document.getElementById('outlineRangeScoresMin').innerText = '';
      document.getElementById('outlineRangeScoresMax').innerText = '';
    } else {
      ScoresOutlineRange.removeAttribute('disabled');
      ScoresOutlineRange.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOutline,
          'max': adjustedMaxOutline
        },
        step: outlineStep
      });
      ScoresOutlineRange.noUiSlider.set([adjustedMinOutline, adjustedMaxOutline]);
      document.getElementById('outlineRangeScoresMin').innerText = formatValue(adjustedMinOutline, outlineStep);
      document.getElementById('outlineRangeScoresMax').innerText = formatValue(adjustedMaxOutline, outlineStep);
    }
  }
}

function updateScoresLayer() {
  const selectedYear = ScoresYear.value;
  if (!selectedYear) {
    return;
  }
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const opacityField = ScoresOpacity.value;
  const outlineField = ScoresOutline.value;

  map.eachLayer(layer => {
    if (layer !== baseLayer) {
      map.removeLayer(layer);
    }
  });

  const fieldToDisplay = selectedYear.includes('-') ? `${selectedPurpose}_${selectedMode}` : `${selectedPurpose}_${selectedMode}_100`;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const filteredFeatures = selectedLayer.features.filter(feature => {
      const value = feature.properties[fieldToDisplay];
      return feature.properties[fieldToDisplay] !== undefined && isClassVisible(value, selectedYear);
    });

    let minOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[0]) : 0;
    let maxOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[1]) : 0;
    let minOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[0]) : 0;
    let maxOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[1]) : 0;

    const filteredScoresLayer = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    const ScoresLayer = L.geoJSON(filteredScoresLayer, {
      style: feature => styleScoresFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacity, maxOpacity, minOutline, maxOutline, selectedYear),
      onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear, selectedPurpose, selectedMode)
    }).addTo(map);

    currentAmenitiesCatchmentLayer = null; // Ensure currentAmenitiesCatchmentLayer is null when displaying scores
    updateLegend();
  }
}

function initializeAmenitiesSliders() {
  AmenitiesOpacityRange = document.getElementById('opacityRangeAmenitiesSlider');
  AmenitiesOutlineRange = document.getElementById('outlineRangeAmenitiesSlider');
  initializeSliders(AmenitiesOpacityRange, updateAmenitiesLayer);
  initializeSliders(AmenitiesOutlineRange, updateAmenitiesLayer);
}

function toggleInverseOpacityAmenitiesScale() {
  isInverseAmenitiesOpacity = !isInverseAmenitiesOpacity;
  const handles = AmenitiesOpacityRange.querySelectorAll('.noUi-handle');
  const connectElements = AmenitiesOpacityRange.querySelectorAll('.noUi-connect');

  if (isInverseAmenitiesOpacity) {
    AmenitiesOpacityRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.add('noUi-handle-transparent');
    handles[0].classList.remove('noUi-handle-transparent');
    connectElements[0].classList.add('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-right');
    connectElements[1].classList.add('noUi-connect-gradient-left');
    connectElements[2].classList.remove('noUi-connect-dark-grey');
  } else {
    AmenitiesOpacityRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.remove('noUi-handle-transparent');
    handles[0].classList.add('noUi-handle-transparent');
    connectElements[0].classList.remove('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-left');
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  opacityAmenitiesOrder = opacityAmenitiesOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';

  updateOpacitySliderAmenitiesRanges();
  updateAmenitiesLayer();
}

function toggleInverseOutlineAmenitiesScale() {
  isInverseAmenitiesOutline = !isInverseAmenitiesOutline;
  const handles = AmenitiesOutlineRange.querySelectorAll('.noUi-handle');
  const connectElements = AmenitiesOutlineRange.querySelectorAll('.noUi-connect');

  if (isInverseAmenitiesOutline) {
    AmenitiesOutlineRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.add('noUi-handle-transparent');
    handles[0].classList.remove('noUi-handle-transparent');
    connectElements[0].classList.add('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-right');
    connectElements[1].classList.add('noUi-connect-gradient-left');
    connectElements[2].classList.remove('noUi-connect-dark-grey');
  } else {
    AmenitiesOutlineRange.noUiSlider.updateOptions({
      connect: [true, true, true]
    });
    handles[1].classList.remove('noUi-handle-transparent');
    handles[0].classList.add('noUi-handle-transparent');
    connectElements[0].classList.remove('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-left');
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  outlineAmenitiesOrder = outlineAmenitiesOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';

  updateOutlineSliderAmenitiesRanges();
  updateAmenitiesLayer();
}

function updateOpacitySliderAmenitiesRanges() {
  const opacityField = AmenitiesOpacity.value;
  const selectedYear = AmenitiesYear.value;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const opacityValues = opacityField !== "None" ? selectedLayer.features.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0) : [];
    const minOpacity = Math.min(...opacityValues);
    const maxOpacity = Math.max(...opacityValues);
    const roundedMaxOpacity = Math.pow(10, Math.ceil(Math.log10(maxOpacity)));
    let opacityStep = roundedMaxOpacity / 100;

    if (isNaN(opacityStep) || opacityStep <= 0) {
      opacityStep = 1;
    }

    const adjustedMaxOpacity = Math.ceil(maxOpacity / opacityStep) * opacityStep;
    const adjustedMinOpacity = Math.floor(minOpacity / opacityStep) * opacityStep;

    if (opacityField === "None") {
      AmenitiesOpacityRange.setAttribute('disabled', true);
      AmenitiesOpacityRange.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      AmenitiesOpacityRange.noUiSlider.set(['', '']);
      document.getElementById('opacityRangeAmenitiesMin').innerText = '';
      document.getElementById('opacityRangeAmenitiesMax').innerText = '';
    } else {
      AmenitiesOpacityRange.removeAttribute('disabled');
      AmenitiesOpacityRange.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOpacity,
          'max': adjustedMaxOpacity
        },
        step: opacityStep
      });
      AmenitiesOpacityRange.noUiSlider.set([adjustedMinOpacity, adjustedMaxOpacity]);
      document.getElementById('opacityRangeAmenitiesMin').innerText = formatValue(adjustedMinOpacity, opacityStep);
      document.getElementById('opacityRangeAmenitiesMax').innerText = formatValue(adjustedMaxOpacity, opacityStep);
    }
  }
}

function updateOutlineSliderAmenitiesRanges() {
  const outlineField = AmenitiesOutline.value;
  const selectedYear = AmenitiesYear.value;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const outlineValues = outlineField !== "None" ? selectedLayer.features.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0) : [];
    const minOutline = Math.min(...outlineValues);
    const maxOutline = Math.max(...outlineValues);
    const roundedMaxOutline = Math.pow(10, Math.ceil(Math.log10(maxOutline)));
    let outlineStep = roundedMaxOutline / 100;

    if (isNaN(outlineStep) || outlineStep <= 0) {
      outlineStep = 1;
    }

    const adjustedMaxOutline = Math.ceil(maxOutline / outlineStep) * outlineStep;
    const adjustedMinOutline = Math.floor(minOutline / outlineStep) * outlineStep;

    if (outlineField === "None") {
      AmenitiesOutlineRange.setAttribute('disabled', true);
      AmenitiesOutlineRange.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      AmenitiesOutlineRange.noUiSlider.set(['', '']);
      document.getElementById('outlineRangeAmenitiesMin').innerText = '';
      document.getElementById('outlineRangeAmenitiesMax').innerText = '';
    } else {
      AmenitiesOutlineRange.removeAttribute('disabled');
      AmenitiesOutlineRange.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOutline,
          'max': adjustedMaxOutline
        },
        step: outlineStep
      });
      AmenitiesOutlineRange.noUiSlider.set([adjustedMinOutline, adjustedMaxOutline]);
      document.getElementById('outlineRangeAmenitiesMin').innerText = formatValue(adjustedMinOutline, outlineStep);
      document.getElementById('outlineRangeAmenitiesMax').innerText = formatValue(adjustedMaxOutline, outlineStep);
    }
  }
}

function updateAmenitiesLayer() {
  const selectedAmenities = Array.from(AmenitiesPurpose)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);

  const selectedYear = AmenitiesYear.value;
  const selectedMode = AmenitiesMode.value;

  if (!selectedYear || selectedAmenities.length === 0 || !selectedMode) {
    return;
  }

  // Clear hexTimeMap to reflect the current state of selected amenities
  hexTimeMap = {};

  const cacheKeys = selectedAmenities.map(amenity => `${selectedYear}_${amenity}`);
  const fetchPromises = cacheKeys.map(cacheKey => {
    if (!csvDataCache[cacheKey]) {
      const csvPath = `https://AmFa6.github.io/TAF_test/${cacheKey}_csv.csv`;
      return fetch(csvPath)
        .then(response => response.text())
        .then(csvText => {
          const csvData = Papa.parse(csvText, { header: true }).data;
          csvData.forEach(row => {
            if (row.Mode === selectedMode) {
              const hexId = row.OriginName;
              const time = parseFloat(row.Time);
              if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                hexTimeMap[hexId] = time;
              }
            }
          });
          csvDataCache[cacheKey] = csvData;
        });
    } else {
      const csvData = csvDataCache[cacheKey];
      csvData.forEach(row => {
        if (row.Mode === selectedMode) {
          const hexId = row.OriginName;
          const time = parseFloat(row.Time);
          if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
            hexTimeMap[hexId] = time;
          }
        }
      });
      return Promise.resolve();
    }
  });

  Promise.all(fetchPromises).then(() => {
    fetch('https://AmFa6.github.io/TAF_test/HexesSocioEco.geojson')
      .then(response => response.json())
      .then(AmenitiesLayer => {
        map.eachLayer(layer => {
          if (layer !== baseLayer) {
            map.removeLayer(layer);
          }
        });

        const filteredFeatures = AmenitiesLayer.features.filter(feature => {
          const hexId = feature.properties.Hex_ID;
          const time = hexTimeMap[hexId];
          return time !== undefined && isClassVisible(time, selectedYear);
        });

        const filteredAmenitiesLayer = {
          type: "FeatureCollection",
          features: filteredFeatures
        };

        currentAmenitiesCatchmentLayer = L.geoJSON(filteredAmenitiesLayer, {
          style: feature => {
            const hexId = feature.properties.Hex_ID;
            const time = hexTimeMap[hexId];
            let color = 'transparent';

            if (time !== undefined) {
              if (time <= 5) color = '#fde725';
              else if (time <= 10) color = '#7ad151';
              else if (time <= 15) color = '#23a884';
              else if (time <= 20) color = '#2a788e';
              else if (time <= 25) color = '#414387';
              else if (time <= 30) color = '#440154';
            }

            const minOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? parseFloat(AmenitiesOpacityRange.noUiSlider.get()[0]) : 0;
            const maxOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? parseFloat(AmenitiesOpacityRange.noUiSlider.get()[1]) : 0;
            const minOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? parseFloat(AmenitiesOutlineRange.noUiSlider.get()[0]) : 0;
            const maxOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? parseFloat(AmenitiesOutlineRange.noUiSlider.get()[1]) : 0;

            let opacity;
            if (AmenitiesOpacity.value === 'None') {
              opacity = 0.8;
            } else {
              const opacityValue = feature.properties[AmenitiesOpacity.value];
              if (opacityValue === 0 || opacityValue === null) {
                opacity = isInverseAmenitiesOpacity ? 0.8 : 0.1;
              } else {
                opacity = scaleExp(opacityValue, minOpacityValue, maxOpacityValue, 0.1, 0.8, opacityAmenitiesOrder);
              }
            }
            let weight;
            if (AmenitiesOutline.value === 'None') {
              weight = 0;
            } else {
              const outlineValue = feature.properties[AmenitiesOutline.value];
              if (outlineValue === 0 || outlineValue === null || outlineValue === undefined || outlineValue === '') {
                weight = 0;
              } else {
                weight = scaleExp(outlineValue, minOutlineValue, maxOutlineValue, 0, 4, outlineAmenitiesOrder);
              }
            }

            return {
              fillColor: color,
              weight: weight,
              opacity: 1,
              color: 'black',
              fillOpacity: opacity
            };
          },
          onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear, selectedAmenities.join(','), selectedMode)
        }).addTo(map);

        updateLegend();
      });
  });
}
