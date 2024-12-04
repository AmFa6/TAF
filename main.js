// Initialize the map
const map = L.map('map').setView([51.480, -2.591], 11);

// Add a base layer
const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
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

// Set default value for opacity field and call updateLayerVisibility when the page loads
document.addEventListener("DOMContentLoaded", () => {
  opacityFieldDropdown.value = "pop";
  updateLayerVisibility();
});

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

// Function to update layer visibility
function updateLayerVisibility() {
  const selectedYear = yearDropdown.value;
  const selectedPurpose = purposeDropdown.value;
  const selectedMode = modeDropdown.value;
  const opacityField = opacityFieldDropdown.value;
  const outlineField = outlineFieldDropdown.value;

  // Hide all layers except the base layer
  map.eachLayer(layer => {
    if (layer !== baseLayer) {
      map.removeLayer(layer);
    }
  });

  // Determine the field to display based on the selected purpose and mode
  const fieldToDisplay = selectedYear.includes('-') ? `${purposeMap[selectedPurpose]}_${modeMap[selectedMode]}` : `${purposeMap[selectedPurpose]}_${modeMap[selectedMode]}_100`;

  // Show the selected layer
  const selectedLayer = layers[selectedYear];
  if (selectedLayer) {
    const filteredFeatures = selectedLayer.features.filter(feature => {
      return feature.properties[fieldToDisplay] !== undefined;
    });

    // Calculate min and max values for opacity and outline fields
    const opacityValues = filteredFeatures.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0);
    const outlineValues = filteredFeatures.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0);

    let minOpacity = opacityValues.length > 0 ? Math.min(...opacityValues) : 0;
    let maxOpacity = opacityValues.length > 0 ? Math.max(...opacityValues) : 1;
    let minOutline = outlineValues.length > 0 ? Math.min(...outlineValues) : 0;
    let maxOutline = outlineValues.length > 0 ? Math.max(...outlineValues) : 1;

    // Round values based on field type
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

    // Calculate the maximum absolute value for all features
    const maxAbsValue = Math.max(...filteredFeatures.map(feature => Math.abs(feature.properties[fieldToDisplay])));

    // Update the input fields with the calculated min and max values if auto-update is enabled
    if (autoUpdateOpacity) {
      minOpacityValueInput.value = minOpacity;
      maxOpacityValueInput.value = maxOpacity;
    }
    if (autoUpdateOutline) {
      minOutlineValueInput.value = minOutline;
      maxOutlineValueInput.value = maxOutline;
    }

    // Ensure input values are valid numbers
    const minOpacityValue = parseFloat(minOpacityValueInput.value) || 0;
    const maxOpacityValue = parseFloat(maxOpacityValueInput.value) || 1;
    const minOutlineValue = parseFloat(minOutlineValueInput.value) || 0;
    const maxOutlineValue = parseFloat(maxOutlineValueInput.value) || 1;
    const opacityExponent = parseFloat(opacityExponentInput.value) || 1;
    const outlineExponent = parseFloat(outlineExponentInput.value) || 1;

    // Default opacity and outline if "No Field" is selected
    const defaultOpacity = 0.75;
    const defaultOutlineWidth = 0;

    const filteredGeoJson = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    const geoJsonLayer = L.geoJSON(filteredGeoJson, {
      style: feature => styleFeature(
        feature, 
        fieldToDisplay, 
        opacityField === 'none' ? defaultOpacity : feature.properties[opacityField], 
        outlineField === 'none' ? defaultOutlineWidth : feature.properties[outlineField], 
        minOpacityValue, 
        maxOpacityValue, 
        opacityExponent, 
        minOutlineValue, 
        maxOutlineValue, 
        outlineExponent, 
        selectedYear, 
        maxAbsValue
      )
    }).addTo(map);
  }
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
minOpacityValueInput.addEventListener("blur", () => {
  autoUpdateOpacity = false;
  updateLayerVisibility();
});
maxOpacityValueInput.addEventListener("blur", () => {
  autoUpdateOpacity = false;
  updateLayerVisibility();
});
opacityExponentInput.addEventListener("input", updateLayerVisibility);
minOutlineValueInput.addEventListener("blur", () => {
  autoUpdateOutline = false;
  updateLayerVisibility();
});
maxOutlineValueInput.addEventListener("blur", () => {
  autoUpdateOutline = false;
  updateLayerVisibility();
});
outlineExponentInput.addEventListener("input", updateLayerVisibility);

// Function to style features
function styleFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacityValue, maxOpacityValue, opacityExponent, minOutlineValue, maxOutlineValue, outlineExponent, selectedYear, maxAbsValue) {
  const value = feature.properties[fieldToDisplay];
  const color = getColor(value, selectedYear, maxAbsValue);
  const opacity = opacityField === 0.75 ? 0.75 : scaleExp(feature.properties[opacityField], minOpacityValue, maxOpacityValue, opacityExponent, 0.1, 1, opacityOrder);
  const weight = outlineField === 0 ? 0 : scaleExp(feature.properties[outlineField], minOutlineValue, maxOutlineValue, outlineExponent, 1, 10, outlineOrder);
  return {
    fillColor: color,
    weight: weight,
    opacity: 1,
    color: 'black',
    fillOpacity: opacity
  };
}

// Function to get color based on value and year
function getColor(value, year, maxAbsValue) {
  console.log(`getColor called with value: ${value}, year: ${year}, maxAbsValue: ${maxAbsValue}`);
  if (year.includes('-')) {
    const color = value > maxAbsValue / 2 ? '#1a9641' :
           value > maxAbsValue / 4 ? '#77c35c' :
           value > 0 ? '#c4e687' :
           value === 0 ? 'rgba(0, 0, 0, 0)' :
           value > -maxAbsValue / 4 ? '#fec981' :
           value > -maxAbsValue / 2 ? '#f07c4a' :
                                      '#d7191c';
    console.log(`Returning color: ${color}`);
    return color;
  } else {
    const color = value > 90 ? '#fde725' :
           value > 80 ? '#b5de2b' :
           value > 70 ? '#6ece58' :
           value > 60 ? '#35b779' :
           value > 50 ? '#1f9e89' :
           value > 40 ? '#26828e' :
           value > 30 ? '#31688e' :
           value > 20 ? '#3e4989' :
           value > 10 ? '#482777' :
                        '#440154';
    console.log(`Returning color: ${color}`);
    return color;
  }
}

// Function to scale values exponentially
function scaleExp(value, minVal, maxVal, exponent, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = Math.pow(normalizedValue, exponent);
  return order === 'low-to-high' ? minScale + scaledValue * (maxScale - minScale) : maxScale - scaledValue * (maxScale - minScale);
}
