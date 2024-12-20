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

    // Handle 'None' option for opacity field
    if (opacityField === 'None') {
      minOpacityValueInput.value = '';
      maxOpacityValueInput.value = '';
    } else {
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

      // Calculate maxAbsValue
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

      const filteredGeoJson = {
        type: "FeatureCollection",
        features: filteredFeatures
      };

      const geoJsonLayer = L.geoJSON(filteredGeoJson, {
        style: feature => styleFeature(feature, fieldToDisplay, opacityField, outlineField, parseFloat(minOpacityValueInput.value), parseFloat(maxOpacityValueInput.value), parseFloat(opacityExponentInput.value), parseFloat(minOutlineValueInput.value), parseFloat(maxOutlineValueInput.value), parseFloat(outlineExponentInput.value), selectedYear, maxAbsValue),
        onEachFeature: onEachFeature
      }).addTo(map);
    }
  }

  updateLegend();
}

// Function to display pop-up on feature click
function onEachFeature(feature, layer) {
  layer.on({
    click: function (e) {
      const properties = feature.properties;
      const getValue = (prop) => (properties[prop] !== undefined && properties[prop] !== null) ? properties[prop] : '-';
      const hexId = getValue('Hex_ID');
      const score = getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}`) !== '-' ? Math.round(getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}`)) : '-';
      const percentile = getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}_100`) !== '-' ? Math.round(getValue(`${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}_100`)) : '-';
      const population = getValue('pop') !== '-' ? Math.round(getValue('pop')) : '-';
      const imd = population === 0 ? '-' : (getValue('imd') !== '-' ? getValue('imd').toFixed(2) : '-');
      const carAvailability = population === 0 ? '-' : (getValue('carav') !== '-' ? getValue('carav').toFixed(2) : '-');
      const futureDwellings = getValue('hh_fut') === 0 ? '-' : (getValue('hh_fut') !== '-' ? Math.round(getValue('hh_fut')) : '-');
      
      let popupContent = `<strong>Hex_ID:</strong> ${hexId}<br><strong>Score:</strong> ${score}<br><strong>Percentile:</strong> ${percentile}<br><strong>Population:</strong> ${population}<br><strong>Index of Multiple Deprivation:</strong> ${imd}<br><strong>Car Availability:</strong> ${carAvailability}<br><strong>Future Dwellings:</strong> ${futureDwellings}`;
      
      L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
    }
  });
}

function updateLegend() {
  const selectedYear = yearDropdown.value;
  const legendContent = document.getElementById("legend-content");

  legendContent.innerHTML = '';

  const maxAbsValue = Math.round(calculateMaxAbsValue(selectedYear) * 100); // convert to percentage
  const halfMax = Math.round((maxAbsValue / 2) / 10) * 10;
  const quarterMax = Math.round((maxAbsValue / 4) / 10) * 10;

  const headerText = selectedYear.includes('-') ? "Score Difference (%)" : "Population Percentiles";
  const headerDiv = document.createElement("div");
  headerDiv.innerHTML = `${headerText}`;
  headerDiv.style.fontSize = "1.1em";
  headerDiv.style.marginBottom = "10px";
  legendContent.appendChild(headerDiv);
  
  if (selectedYear.includes('-')) {
    // Display dynamic classes for years with '-'
    const classes = [
      { range: `> ${halfMax}%`, color: "#1a9641" },
      { range: `${quarterMax}% to ${halfMax}%`, color: "#77c35c" },
      { range: `0% to ${quarterMax}%`, color: "#c4e687" },
      { range: `0%`, color: "rgba(0, 0, 0, 0)" },
      { range: `-0% to -${quarterMax}%`, color: "#fec981" },
      { range: `-${quarterMax}% to -${halfMax}%`, color: "#f07c4a" },
      { range: `< -${halfMax}%`, color: "#d7191c" }
    ];
    classes.forEach(c => {
      const div = document.createElement("div");
      div.innerHTML = `<span style="display: inline-block; width: 20px; height: 20px; background-color: ${c.color};"></span> ${c.range}`;
      legendContent.appendChild(div);
    });
  } else {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const classes = [
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
}

function calculateMaxAbsValue(selectedYear) {
  const selectedLayer = layers[selectedYear];
  const fieldToDisplay = `${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}`;
  const filteredFeatures = selectedLayer.features.filter(feature => feature.properties[fieldToDisplay] !== undefined);
  return Math.max(...filteredFeatures.map(feature => Math.abs(feature.properties[fieldToDisplay])));
}

function calculateMaxAbsValue(selectedYear) {
  const selectedLayer = layers[selectedYear];
  const fieldToDisplay = `${purposeMap[purposeDropdown.value]}_${modeMap[modeDropdown.value]}`;
  const filteredFeatures = selectedLayer.features.filter(feature => feature.properties[fieldToDisplay] !== undefined);
  return Math.max(...filteredFeatures.map(feature => Math.abs(feature.properties[fieldToDisplay])));
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
  const opacity = opacityField === 'None' ? 0.75 : (feature.properties[opacityField] === 0 || feature.properties[opacityField] === null ? 0.05 : scaleExp(feature.properties[opacityField], minOpacityValue, maxOpacityValue, opacityExponent, 0.05, 0.95, opacityOrder));
  const weight = outlineField === 'None' ? 0 : (feature.properties[outlineField] === 0 || feature.properties[outlineField] === null ? 0 : scaleExp(feature.properties[outlineField], minOutlineValue, maxOutlineValue, outlineExponent, 0, 3, outlineOrder));
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
  const roundedMaxAbsValue = Math.round(maxAbsValue / 10) * 10;
  const halfMax = Math.round((roundedMaxAbsValue / 2) / 10) * 10;
  const quarterMax = Math.round((roundedMaxAbsValue / 4) / 10) * 10;

  if (year.includes('-')) {
    return value > halfMax ? '#1a9641' :
           value > quarterMax ? '#77c35c' :
           value > 0 ? '#c4e687' :
           value === 0 ? 'rgba(0, 0, 0, 0)' :
           value > -quarterMax ? '#fec981' :
           value > -halfMax ? '#f07c4a' :
                              '#d7191c';
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

// Function to scale values exponentially
function scaleExp(value, minVal, maxVal, exponent, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = Math.pow(normalizedValue, exponent / 20);
  return order === 'low-to-high' ? minScale + scaledValue * (maxScale - minScale) : maxScale - scaledValue * (maxScale - minScale);
}
