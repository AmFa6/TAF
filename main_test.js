// Initialize the map
const map = L.map('map').setView([51.480, -2.591], 11);

// Add a base layer
const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB'
}).addTo(map);

// List of GeoJSON files and corresponding years
const geoJsonFiles = [
  { year: '2024', path: 'https://AmFa6.github.io/TAF/2024_connectscore.geojson' },
  { year: '2023', path: 'https://AmFa6.github.io/TAF/2023_connectscore.geojson' },
  { year: '2022', path: 'https://AmFa6.github.io/TAF/2022_connectscore.geojson' },
  { year: '2019', path: 'https://AmFa6.github.io/TAF/2019_connectscore.geojson' },
  { year: '2023-2024', path: 'https://AmFa6.github.io/TAF/2023-2024_connectscore.geojson' },
  { year: '2019-2024', path: 'https://AmFa6.github.io/TAF/2019-2024_connectscore.geojson' },
  { year: '2022-2023', path: 'https://AmFa6.github.io/TAF/2022-2023_connectscore.geojson' },
  { year: '2019-2023', path: 'https://AmFa6.github.io/TAF/2019-2023_connectscore.geojson' }, 
  { year: '2019-2022', path: 'https://AmFa6.github.io/TAF/2019-2022_connectscore.geojson' }
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
const minOpacityValueInput = document.getElementById("minOpacityValue");
const maxOpacityValueInput = document.getElementById("maxOpacityValue");
const opacityExponentInput = document.getElementById("opacityExponent");
const minOutlineValueInput = document.getElementById("minOutlineValue");
const maxOutlineValueInput = document.getElementById("maxOutlineValue");
const outlineExponentInput = document.getElementById("outlineExponent");

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

// Add a slider with two toggles for min and max values
const sliderContainer = document.createElement('div');
sliderContainer.id = 'sliderContainer';
document.querySelector('.range-slider-container').appendChild(sliderContainer);

noUiSlider.create(sliderContainer, {
  start: [0, 100], // Initial values for min and max
  connect: true,
  range: {
    'min': 0,
    'max': 100
  },
  tooltips: [true, true],
  format: {
    to: value => Math.round(value),
    from: value => Number(value)
  }
});

// Event listener for slider changes
sliderContainer.noUiSlider.on('update', (values, handle) => {
  const minValue = values[0];
  const maxValue = values[1];

  // Update min and max inputs
  minOpacityValueInput.value = minValue;
  maxOpacityValueInput.value = maxValue;

  // Update layer visibility based on new values
  updateLayerVisibility();
});

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

    if (opacityField === 'None') {
      minOpacityValueInput.value = '';
      maxOpacityValueInput.value = '';
    } else {
      const opacityValues = filteredFeatures.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0);
      const outlineValues = filteredFeatures.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0);

      let minOpacity = opacityValues.length > 0 ? Math.min(...opacityValues) : 0;
      let maxOpacity = opacityValues.length > 0 ? Math.max(...opacityValues) : 1;
      let minOutline = outlineValues.length > 0 ? Math.min(...outlineValues) : 0;
      let maxOutline = outlineValues.length > 0 ? Math.max(...outlineValues) : 1;

      if (opacityField === 'pop' || opacityField === 'hh_fut') {
        minOpacity = Math.floor(minOpacity);
        maxOpacity = Math.ceil(maxOpacity);
      } else {
        minOpacity = Math.floor(minOpacity * 100) / 100;
        maxOpacity = Math.ceil(maxOpacity * 100) / 100;
      }

      if (outlineField === 'pop' || outlineField === 'hh_fut') {
        minOutline = Math.floor(minOutline);
        maxOutline = Math.ceil(maxOutline);
      } else {
        minOutline = Math.floor(minOutline * 100) / 100;
        maxOutline = Math.ceil(maxOutline * 100) / 100;
      }

      if (autoUpdateOpacity) {
        minOpacityValueInput.value = minOpacity;
        maxOpacityValueInput.value = maxOpacity;
      }
      if (autoUpdateOutline) {
        minOutlineValueInput.value = minOutline;
        maxOutlineValueInput.value = maxOutline;
      }

      const filteredGeoJson = {
        type: "FeatureCollection",
        features: filteredFeatures
      };

      const geoJsonLayer = L.geoJSON(filteredGeoJson, {
        style: feature => styleFeature(feature, fieldToDisplay, opacityField, outlineField, parseFloat(minOpacityValueInput.value), parseFloat(maxOpacityValueInput.value), parseFloat(opacityExponentInput.value), parseFloat(minOutlineValueInput.value), parseFloat(maxOutlineValueInput.value), parseFloat(outlineExponentInput.value), selectedYear),
        onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear)
      }).addTo(map);
    }
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

// Function to reset opacity values to default
function resetOpacityValues() {
  autoUpdateOpacity = true;
  updateLayerVisibility();
}

// Function to reset outline values to default
function resetOutlineValues() {
  autoUpdateOutline = true;
  updateLayerVisibility();
}

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

// Add event listeners to reset buttons
const resetOpacityButton = document.getElementById("resetOpacityButton");
resetOpacityButton.addEventListener("click", resetOpacityValues);

const resetOutlineButton = document.getElementById("resetOutlineButton");
resetOutlineButton.addEventListener("click", resetOutlineValues);

// Add event listeners to inverse scale buttons
const inverseOpacityScaleButton = document.getElementById("inverseOpacityScaleButton");
inverseOpacityScaleButton.addEventListener("click", inverseOpacityScale);

const inverseOutlineScaleButton = document.getElementById("inverseOutlineScaleButton");
inverseOutlineScaleButton.addEventListener("click", inverseOutlineScale);

// Add event listeners to dropdowns and inputs
yearDropdown.addEventListener("change", updateLayerVisibility);
purposeDropdown.addEventListener("change", updateLayerVisibility);
modeDropdown.addEventListener("change", updateLayerVisibility);
opacityFieldDropdown.addEventListener("change", () => {
  autoUpdateOpacity = true;
  updateLayerVisibility();
});
outlineFieldDropdown.addEventListener("change", () => {
  autoUpdateOutline = true;
  updateLayerVisibility();
});
minOpacityValueInput.addEventListener("input", () => {
  autoUpdateOpacity = false;
  updateLayerVisibility();
});
maxOpacityValueInput.addEventListener("input", () => {
  autoUpdateOpacity = false;
  updateLayerVisibility();
});
opacityExponentInput.addEventListener("input", updateLayerVisibility);
minOutlineValueInput.addEventListener("input", () => {
  autoUpdateOutline = false;
  updateLayerVisibility();
});
maxOutlineValueInput.addEventListener("input", () => {
  autoUpdateOutline = false;
  updateLayerVisibility();
});
outlineExponentInput.addEventListener("input", updateLayerVisibility);

// Function to style features
function styleFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacityValue, maxOpacityValue, opacityExponent, minOutlineValue, maxOutlineValue, outlineExponent, selectedYear) {
  const value = feature.properties[fieldToDisplay];
  const color = getColor(value, selectedYear);

  const opacity = opacityField === 'None' ? 0.75 : (feature.properties[opacityField] === 0 || feature.properties[opacityField] === null ? 0.05 : scaleExp(feature.properties[opacityField], minOpacityValue, maxOpacityValue, opacityExponent, 0.05, 0.75, opacityOrder));
  const weight = outlineField === 'None' ? 0 : (feature.properties[outlineField] === 0 || feature.properties[outlineField] === null ? 0 : scaleExp(feature.properties[outlineField], minOutlineValue, maxOutlineValue, outlineExponent, 0, 6, outlineOrder));
  
  return {
    fillColor: color,
    weight: weight,
    opacity: 1,
    color: 'black',
    fillOpacity: opacity
  };
}

// Function to scale values exponentially
function scaleExp(value, minVal, maxVal, exponent, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = Math.pow(normalizedValue, exponent / 20);
  return order
