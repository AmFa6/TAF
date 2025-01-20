// Initialize the map
const map = L.map('map').setView([51.480, -2.591], 11);

// Add a base layer
const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB'
}).addTo(map);

// List of GeoJSON files and corresponding years
const geoJsonFiles = [
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

// Load GeoJSON layers
const layers = {};
let layersLoaded = 0;
const totalLayers = geoJsonFiles.length;

geoJsonFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(geoJson => {
      layers[file.year] = geoJson;
      console.log(`Loaded GeoJSON for year ${file.year}`);
      layersLoaded++;
      if (layersLoaded === totalLayers) {
        initializeSliders();
        updateSliderRanges();
        updateLayerVisibility();
      }
    })
    .catch(error => console.error(`Error loading GeoJSON: ${error.message}`));
});

// Populate year dropdown
const yearDropdown = document.getElementById("yearDropdown");
geoJsonFiles.forEach(file => {
  const option = document.createElement("option");
  option.value = file.year;
  option.text = file.year;
  yearDropdown.add(option);
});

// Get other dropdown elements
const purposeDropdown = document.getElementById("purposeDropdown");
const modeDropdown = document.getElementById("modeDropdown");
const opacityFieldDropdown = document.getElementById("opacityFieldDropdown");
const outlineFieldDropdown = document.getElementById("outlineFieldDropdown");

// Ensure 'Population' is the default value for opacityFieldDropdown
opacityFieldDropdown.value = "pop";

// Ensure 'None' is the default value for outlineFieldDropdown
outlineFieldDropdown.value = "None";

// Maps for purpose and mode
const purposeMap = {
  "Education": "Edu",
  "Employment": "Emp",
  "Health": "Hth",
  "High Street": "HSt",
  "All Amenities": "All"
};

const modeMap = {
  "Walk": "Wa",
  "Cycle": "Cy",
  "Public Transport": "PT",
  "Car": "Ca",
  "All Modes": "To" // Assuming "To" is the suffix for all modes
};

let autoUpdateOpacity = true;
let autoUpdateOutline = true;
let opacityOrder = 'low-to-high';
let outlineOrder = 'low-to-high';

let opacityRangeSlider;
let outlineRangeSlider;

function initializeSliders() {
  // Initialize noUiSlider for opacity range
  opacityRangeSlider = document.getElementById('opacityRangeSlider');
  noUiSlider.create(opacityRangeSlider, {
    start: [0, 0],
    connect: [false, true, true], // Set left connect to false and right to true
    range: {
      'min': 0,
      'max': 0
    },
    step: 1,
    tooltips: false,
    format: {
      to: value => parseFloat(value).toFixed(2), // Ensure two decimal places
      from: value => parseFloat(value)
    }
  });

  // Apply the class to the left handle
  const handles = opacityRangeSlider.querySelectorAll('.noUi-handle');
  if (handles.length > 0) {
    handles[0].classList.add('noUi-handle-left');
  }

  // Apply the class to the right connect element
  const connectElements = opacityRangeSlider.querySelectorAll('.noUi-connect');
  if (connectElements.length > 1) {
    connectElements[1].classList.add('noUi-connect-right');
    connectElements[1].classList.add('noUi-connect-right-solid');
  }

  // Initialize noUiSlider for outline width range
  outlineRangeSlider = document.getElementById('outlineRangeSlider');
  noUiSlider.create(outlineRangeSlider, {
    start: [0, 0],
    connect: [false, true, true],
    range: {
      'min': 0,
      'max': 0
    },
    step: 1,
    tooltips: false,
    format: {
      to: value => parseFloat(value).toFixed(2), // Ensure two decimal places
      from: value => parseFloat(value)
    }
  });

  const outlineHandles = outlineRangeSlider.querySelectorAll('.noUi-handle');
  if (outlineHandles.length > 0) {
    outlineHandles[0].classList.add('noUi-handle-left');
  }

  // Apply the class to the right connect element
  const outlineConnectElements = outlineRangeSlider.querySelectorAll('.noUi-connect');
  if (outlineConnectElements.length > 1) {
    outlineConnectElements[1].classList.add('noUi-connect-right');
    outlineConnectElements[1].classList.add('noUi-connect-right-solid');
  }

  // Add event listeners to update map rendering when sliders are adjusted
  opacityRangeSlider.noUiSlider.on('update', updateLayerVisibility);
  outlineRangeSlider.noUiSlider.on('update', updateLayerVisibility);

  // Add event listeners to update range labels
  opacityRangeSlider.noUiSlider.on('update', function(values, handle) {
    document.getElementById('opacityRangeMin').innerText = formatValue(values[0], opacityRangeSlider.noUiSlider.options.step);
    document.getElementById('opacityRangeMax').innerText = formatValue(values[1], opacityRangeSlider.noUiSlider.options.step);
  });

  outlineRangeSlider.noUiSlider.on('update', function(values, handle) {
    document.getElementById('outlineRangeMin').innerText = formatValue(values[0], outlineRangeSlider.noUiSlider.options.step);
    document.getElementById('outlineRangeMax').innerText = formatValue(values[1], outlineRangeSlider.noUiSlider.options.step);
  });
}

// Function to format values based on step size for display
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

function updateSliderRanges() {
  const opacityField = opacityFieldDropdown.value;
  const outlineField = outlineFieldDropdown.value;

  const selectedYear = yearDropdown.value;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const opacityValues = opacityField !== "None" ? selectedLayer.features.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0) : [];
    const outlineValues = outlineField !== "None" ? selectedLayer.features.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0) : [];

    const minOpacity = Math.min(...opacityValues);
    const maxOpacity = Math.max(...opacityValues);
    const minOutline = Math.min(...outlineValues);
    const maxOutline = Math.max(...outlineValues);

    const roundedMaxOpacity = Math.pow(10, Math.ceil(Math.log10(maxOpacity)));
    const roundedMaxOutline = Math.pow(10, Math.ceil(Math.log10(maxOutline)));

    let opacityStep = roundedMaxOpacity / 100;
    let outlineStep = roundedMaxOutline / 100;

    if (isNaN(opacityStep) || opacityStep <= 0) {
      opacityStep = 1;
    }
    if (isNaN(outlineStep) || outlineStep <= 0) {
      outlineStep = 1;
    }

    const adjustedMaxOpacity = Math.floor(maxOpacity / opacityStep) * opacityStep;
    const adjustedMinOpacity = Math.ceil(minOpacity / opacityStep) * opacityStep;
    const adjustedMaxOutline = Math.floor(maxOutline / outlineStep) * outlineStep;
    const adjustedMinOutline = Math.ceil(minOutline / outlineStep) * outlineStep;

    if (opacityField === "None") {
      opacityRangeSlider.setAttribute('disabled', true);
      opacityRangeSlider.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      opacityRangeSlider.noUiSlider.set([0, 0]);
      document.getElementById('opacityRangeMin').innerText = '';
      document.getElementById('opacityRangeMax').innerText = '';
    } else {
      opacityRangeSlider.removeAttribute('disabled');
      opacityRangeSlider.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOpacity,
          'max': adjustedMaxOpacity
        },
        step: opacityStep
      });
      opacityRangeSlider.noUiSlider.set([adjustedMinOpacity, adjustedMaxOpacity]);
      document.getElementById('opacityRangeMin').innerText = formatValue(adjustedMinOpacity, opacityStep);
      document.getElementById('opacityRangeMax').innerText = formatValue(adjustedMaxOpacity, opacityStep);
    }
    if (outlineField === "None") {
      outlineRangeSlider.setAttribute('disabled', true);
      outlineRangeSlider.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      });
      outlineRangeSlider.noUiSlider.set([0, 0]);
      document.getElementById('outlineRangeMin').innerText = '';
      document.getElementById('outlineRangeMax').innerText = '';
    } else {
      outlineRangeSlider.removeAttribute('disabled');
      outlineRangeSlider.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinOutline,
          'max': adjustedMaxOutline
        },
        step: parseFloat(outlineStep.toFixed(1))
      });
      outlineRangeSlider.noUiSlider.set([adjustedMinOutline, adjustedMaxOutline]);
      document.getElementById('outlineRangeMin').innerText = formatValue(adjustedMinOutline, outlineStep);
      document.getElementById('outlineRangeMax').innerText = formatValue(adjustedMaxOutline, outlineStep);
    }
  } else {
    console.error('Selected layer not found for year:', selectedYear);
  }
}

// Function to update layer visibility
function updateLayerVisibility() {
  const selectedYear = yearDropdown.value;
  if (!selectedYear) {
    console.error('No year selected');
    return;
  }
  const selectedPurpose = purposeDropdown.value;
  const selectedMode = modeDropdown.value;
  const opacityField = opacityFieldDropdown.value;
  const outlineField = outlineFieldDropdown.value;

  map.eachLayer(layer => {
    if (layer !== baseLayer) {
      map.removeLayer(layer);
    }
  });

  const fieldToDisplay = selectedYear.includes('-') ? `${purposeMap[selectedPurpose]}_${modeMap[selectedMode]}` : `${purposeMap[selectedPurpose]}_${modeMap[selectedMode]}_100`;
  const selectedLayer = layers[selectedYear];

  if (selectedLayer) {
    const filteredFeatures = selectedLayer.features.filter(feature => {
      return feature.properties[fieldToDisplay] !== undefined;
    });

    let minOpacity = parseFloat(opacityRangeSlider.noUiSlider.get()[0]);
    let maxOpacity = parseFloat(opacityRangeSlider.noUiSlider.get()[1]);
    let minOutline = parseFloat(outlineRangeSlider.noUiSlider.get()[0]);
    let maxOutline = parseFloat(outlineRangeSlider.noUiSlider.get()[1]);

    console.log(`Opacity range: min=${minOpacity}, max=${maxOpacity}`);
    console.log(`Outline range: min=${minOutline}, max=${maxOutline}`);

    const filteredGeoJson = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    const geoJsonLayer = L.geoJSON(filteredGeoJson, {
      style: feature => styleFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacity, maxOpacity, minOutline, maxOutline, selectedYear),
      onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear)
    }).addTo(map);
  }

  updateLegend();
}

// Function to display pop-up on feature click
function onEachFeature(feature, layer, selectedYear) {
  layer.on({
    click: function (e) {
      const properties = feature.properties;
      const getValue = (prop) => (properties[prop] !== undefined && properties[prop] !== null) ? properties[prop] : '-';
      const hexId = getValue('Hex_ID');
      const scoreValue = getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}`);
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
      
      const percentile = getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}_100`) !== '-' ? Math.round(getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}_100`)) : '-';
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
    console.error('No year selected');
    return 'transparent';
  }

  if (selectedYear.includes('-')) {
    if (value <= -0.2) {
      return '#FF0000'; // Red
    } else if (value > -0.2 && value <= -0.1) {
      return '#FF5500'; // Orange-Red
    } else if (value > -0.1 && value < 0) {
      return '#FFAA00'; // Orange
    } else if (value === 0) {
      return 'transparent'; // No colour or 100% transparency
    } else if (value > 0 && value <= 0.1) {
      return '#B0E200'; // Light Green
    } else if (value >= 0.1 && value < 0.2) {
      return '#6EC500'; // Green
    } else {
      return '#38A800'; // Dark Green
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

function updateLegend() {
  const selectedYear = yearDropdown.value;
  const legendContent = document.getElementById("legend-content");

  legendContent.innerHTML = '';

  const headerText = selectedYear.includes('-') ? "Score Difference" : "Population Percentiles";
  const headerDiv = document.createElement("div");
  headerDiv.innerHTML = `${headerText}`;
  headerDiv.style.fontSize = "1.1em";
  headerDiv.style.marginBottom = "10px";
  legendContent.appendChild(headerDiv);

  const classes = selectedYear.includes('-') ? [
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

  classes.forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `<span style="display: inline-block; width: 20px; height: 20px; background-color: ${c.color};"></span> ${c.range}`;
    legendContent.appendChild(div);
  });
}

let isInverse = false;

function toggleInverseScale() {
  isInverse = !isInverse;
  const opacityRangeSlider = document.getElementById('opacityRangeSlider');
  const handles = opacityRangeSlider.querySelectorAll('.noUi-handle');
  const connectElements = opacityRangeSlider.querySelectorAll('.noUi-connect');

  if (isInverse) {
    handles[0].classList.remove('noUi-handle-left');
    handles[1].classList.add('noUi-handle-left');
    connectElements[0].classList.remove('noUi-connect-right-solid');
    connectElements[0].style.background = 'linear-gradient(to right, #767676 0%, rgba(118, 118, 118, 1) 50%, rgba(118, 118, 118, 0) 100%)';
    connectElements[1].style.background = '#767676';
  } else {
    handles[1].classList.remove('noUi-handle-left');
    handles[0].classList.add('noUi-handle-left');
    connectElements[0].style.background = 'linear-gradient(to right, rgba(118, 118, 118, 0) 0%, rgba(118, 118, 118, 1) 50%, #767676 50%)';
    connectElements[1].style.background = '#767676';
  }
}

document.getElementById('inverseOpacityScaleButton').addEventListener('click', toggleInverseScale);
// Function to inverse opacity scale
function inverseOpacityScale() {
  opacityOrder = opacityOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';
  updateLayerVisibility();
}

// Function to inverse outline scale
function inverseOutlineScale() {
  outlineOrder = outlineOrder === 'low-to-high' ? 'high-to-low' : 'low-to-high';
  updateLayerVisibility();
}

// Add event listeners to inverse scale buttons
const inverseOpacityScaleButton = document.getElementById("inverseOpacityScaleButton");
inverseOpacityScaleButton.addEventListener("click", inverseOpacityScale);

const inverseOutlineScaleButton = document.getElementById("inverseOutlineScaleButton");
inverseOutlineScaleButton.addEventListener("click", inverseOutlineScale);

// Add event listeners to dropdowns and inputs
yearDropdown.addEventListener("change", () => {
  updateSliderRanges();
  updateLayerVisibility();
});
purposeDropdown.addEventListener("change", updateLayerVisibility);
modeDropdown.addEventListener("change", updateLayerVisibility);
opacityFieldDropdown.addEventListener("change", () => {
  autoUpdateOpacity = true;
  updateSliderRanges();
  updateLayerVisibility();
});
outlineFieldDropdown.addEventListener("change", () => {
  autoUpdateOutline = true;
  updateSliderRanges();
  updateLayerVisibility();
});

// Function to style features
function styleFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacityValue, maxOpacityValue, minOutlineValue, maxOutlineValue, selectedYear) {
  const value = feature.properties[fieldToDisplay];
  const color = getColor(value, selectedYear);

  const opacity = opacityField === 'None' ? 0.75 : (feature.properties[opacityField] === 0 || feature.properties[opacityField] === null ? 0.05 : scaleExp(feature.properties[opacityField], minOpacityValue, maxOpacityValue, 0.05, 0.75, opacityOrder));
  const weight = outlineField === 'None' ? 0 : (feature.properties[outlineField] === 0 || feature.properties[outlineField] === null ? 0 : scaleExp(feature.properties[outlineField], minOutlineValue, maxOutlineValue, 0, 4, outlineOrder));
  
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
