const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB'
}).addTo(map);

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Wards_December_2021_GB_BGC_2022/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText);
    }
    return response.json();
  })
  .then(data => {
    wardBoundariesLayer = L.geoJSON(data, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 1,
          fillOpacity: 0
        };
      },
      onEachFeature: function (feature, layer) {
        layer.on('click', function () {
          L.popup()
            .setLatLng(layer.getBounds().getCenter())
            .setContent(`<strong>Ward Name:</strong> ${feature.properties.WD21NM}`)
            .openOn(map);
        });
      }
    });
  })
  .catch(error => console.error('Error fetching ward boundaries:', error));

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText);
    }
    return response.json();
  })
  .then(data => {
    const lsoaGeoJson = {
      type: 'FeatureCollection',
      features: data.features
    };

    lsoaLayer = L.geoJSON(lsoaGeoJson, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 0.6,
          fillOpacity: 0
        };
      },
      onEachFeature: function (feature, layer) {
        layer.on('click', function () {
          L.popup()
            .setLatLng(layer.getBounds().getCenter())
            .setContent(`<strong>LSOA Code:</strong> ${feature.properties.LSOA21CD}<br><strong>LSOA Name:</strong> ${feature.properties.LSOA21NM}`)
            .openOn(map);
        });
      }
    });
  })
  .catch(error => console.error('Error fetching LSOAs:', error));

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

const AmenitiesFiles = [
  { type: 'PriSch', path: 'https://AmFa6.github.io/TAF_test/PriSch.geojson' },
  { type: 'SecSch', path: 'https://AmFa6.github.io/TAF_test/SecSch.geojson' },
  { type: 'FurEd', path: 'https://AmFa6.github.io/TAF_test/FurEd.geojson' },
  { type: 'Em500', path: 'https://AmFa6.github.io/TAF_test/Em500.geojson' },
  { type: 'Em5000', path: 'https://AmFa6.github.io/TAF_test/Em5000.geojson' },
  { type: 'StrEmp', path: 'https://AmFa6.github.io/TAF_test/StrEmp.geojson' },
  { type: 'CitCtr', path: 'https://AmFa6.github.io/TAF_test/CitCtr.geojson' },
  { type: 'MajCtr', path: 'https://AmFa6.github.io/TAF_test/MajCtr.geojson' },
  { type: 'DisCtr', path: 'https://AmFa6.github.io/TAF_test/DisCtr.geojson' },
  { type: 'GP', path: 'https://AmFa6.github.io/TAF_test/GP.geojson' },
  { type: 'Hos', path: 'https://AmFa6.github.io/TAF_test/Hos.geojson' }
];

const layers = {};
const scoreLayers = {};
const ScoresYear = document.getElementById("yearScoresDropdown");
const ScoresPurpose = document.getElementById("purposeScoresDropdown");
const ScoresMode = document.getElementById("modeScoresDropdown");
const ScoresOpacity = document.getElementById("opacityFieldScoresDropdown");
const ScoresOutline = document.getElementById("outlineFieldScoresDropdown");
const ScoresOpacityRange = document.getElementById('opacityRangeScoresSlider');
const ScoresOutlineRange = document.getElementById('outlineRangeScoresSlider');
const ScoresInverseOpacity = document.getElementById("inverseOpacityScaleScoresButton");
const ScoresInverseOutline = document.getElementById("inverseOutlineScaleScoresButton");
const AmenitiesYear = document.getElementById("yearAmenitiesDropdown");
const AmenitiesMode = document.getElementById("modeAmenitiesDropdown");
const AmenitiesPurpose = document.querySelectorAll('.checkbox-label input[type="checkbox"]');
const AmenitiesOpacity = document.getElementById("opacityFieldAmenitiesDropdown");
const AmenitiesOutline = document.getElementById("outlineFieldAmenitiesDropdown");
const AmenitiesOpacityRange = document.getElementById('opacityRangeAmenitiesSlider');
const AmenitiesOutlineRange = document.getElementById('outlineRangeAmenitiesSlider');
const AmenitiesInverseOpacity = document.getElementById("inverseOpacityScaleAmenitiesButton");
const AmenitiesInverseOutline = document.getElementById("inverseOutlineScaleAmenitiesButton");
const amenityLayers = {};
const purposeToAmenitiesMap = {
  Edu: ['PriSch', 'SecSch', 'FurEd'],
  Emp: ['Em500', 'Em5000', 'StrEmp'],
  HSt: ['CitCtr', 'MajCtr', 'DisCtr'],
  Hth: ['GP', 'Hos'],
  All: ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos']
};
const amenityIcons = {
  PriSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  SecSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  FurEd: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-university" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em500: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em5000: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  StrEmp: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  CitCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-city" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  MajCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-shopping-bag" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  DisCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-store" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  GP: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-stethoscope" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Hos: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-hospital" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] })
};
const filterTypeDropdown = document.getElementById('filterTypeDropdown');
const filterValueDropdown = document.getElementById('filterValueDropdown');

fetch('https://AmFa6.github.io/TAF_test/HexesSocioEco.geojson')
  .then(response => response.json())
  .then(data => {
    hexes = data;
  })

fetch('https://AmFa6.github.io/TAF_test/GrowthZones.geojson')
  .then(response => response.json())
  .then(data => {
    GrowthZonesLayer = L.geoJSON(data, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 2,
          fillOpacity: 0
        };
      },
      onEachFeature: function (feature, layer) {
        layer.on('click', function () {
          L.popup()
            .setLatLng(layer.getBounds().getCenter())
            .setContent(`<strong>Growth Zone:</strong> ${feature.properties.Name}<br><strong>Growth Type:</strong> ${feature.properties.GrowthType}`)
            .openOn(map);
        });
      }
    });
  })
  
ScoresFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(ScoresLayer => {
      scoreLayers[file.year] = ScoresLayer;
    })
}); 

AmenitiesFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(amenityLayer => {
      amenityLayers[file.type] = amenityLayer;
      drawSelectedAmenities([]);
    });
});

ScoresYear.value = "";
ScoresOpacity.value = "None";
ScoresOutline.value = "None";
AmenitiesOpacity.value = "None";
AmenitiesOutline.value = "None";

let opacityScoresOrder = 'low-to-high';
let outlineScoresOrder = 'low-to-high';
let opacityAmenitiesOrder = 'low-to-high';
let outlineAmenitiesOrder = 'low-to-high';
let isInverseScoresOpacity = false;
let isInverseScoresOutline = false;
let isInverseAmenitiesOpacity = false;
let isInverseAmenitiesOutline = false;
let wardBoundariesLayer;
let lsoaLayer;
let GrowthZonesLayer;
let ScoresLayer = null;
let AmenitiesCatchmentLayer = null;
let hexTimeMap = {};
let csvDataCache = {};
let amenitiesLayerGroup = L.featureGroup();
let selectedScoresAmenities = [];
let selectedAmenitiesAmenities = [];
let selectingFromMap = false;
let selectedAmenitiesFromMap = [];
let hexes;

initializeSliders(ScoresOpacityRange, updateScoresLayer);
initializeSliders(ScoresOutlineRange, updateScoresLayer);
initializeSliders(AmenitiesOpacityRange, updateAmenitiesCatchmentLayer);
initializeSliders(AmenitiesOutlineRange, updateAmenitiesCatchmentLayer);

ScoresYear.addEventListener("change", updateScoresLayer)
ScoresPurpose.addEventListener("change", updateScoresLayer);
ScoresMode.addEventListener("change", updateScoresLayer);
AmenitiesYear.addEventListener("change", updateAmenitiesCatchmentLayer);
AmenitiesMode.addEventListener("change", updateAmenitiesCatchmentLayer);
AmenitiesPurpose.forEach(checkbox => {
  checkbox.addEventListener("change", updateAmenitiesCatchmentLayer);
});
ScoresOpacity.addEventListener("change", updateOpacitySliderScoresRanges)
ScoresOutline.addEventListener("change", updateOutlineSliderScoresRanges)
AmenitiesOpacity.addEventListener("change", updateOpacitySliderAmenitiesRanges);
AmenitiesOutline.addEventListener("change", updateOutlineSliderAmenitiesRanges);
ScoresInverseOpacity.addEventListener("click", toggleInverseOpacityScoresScale);
ScoresInverseOutline.addEventListener("click", toggleInverseOutlineScoresScale);
AmenitiesInverseOpacity.addEventListener("click", toggleInverseOpacityAmenitiesScale);
AmenitiesInverseOutline.addEventListener("click", toggleInverseOutlineAmenitiesScale);
filterTypeDropdown.addEventListener('change', () => {
  updateFilterValues();
  updateSummaryStatistics(getCurrentFeatures());
});
filterValueDropdown.addEventListener('change', () => {
  updateSummaryStatistics(getCurrentFeatures());
});

document.addEventListener('DOMContentLoaded', (event) => {
  const collapsibleButtons = document.querySelectorAll(".collapsible");
  collapsibleButtons.forEach(button => {
    const content = button.nextElementSibling;
    content.style.display = "none";
    button.classList.add("collapsed");

    button.addEventListener("click", function() {
      this.classList.toggle("active");
      content.style.display = content.style.display === "block" ? "none" : "block";
      this.classList.toggle("collapsed", content.style.display === "none");
    });
  });
  
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
  panelHeaders.forEach(header => {
    const panelContent = header.nextElementSibling;
    panelContent.style.display = "none";
    header.classList.add("collapsed");

    header.addEventListener("click", function() {
      panelHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          otherHeader.classList.add("collapsed");
          otherHeader.nextElementSibling.style.display = "none";
        }
      });
      panelContent.style.display = panelContent.style.display === "block" ? "none" : "block";
      header.classList.toggle("collapsed", panelContent.style.display === "none");

      if (panelContent.style.display === "block") {
        if (header.textContent.includes("Connectivity Scores")) {
          updateScoresLayer();
        } else if (header.textContent.includes("Journey Time Catchments - Amenities")) {
          updateAmenitiesCatchmentLayer();
        }
      } else {
        if(ScoresLayer) {
          map.removeLayer(ScoresLayer);
          ScoresLayer = null;
        }
        if(AmenitiesCatchmentLayer) {
          map.removeLayer(AmenitiesCatchmentLayer);
          AmenitiesCatchmentLayer = null;
        } 
        drawSelectedAmenities([]);
        updateLegend();
        updateFilterValues();
        updateSummaryStatistics([]);
      }
    });
  });

  const summaryHeader = document.querySelector(".summary-header");
  const summaryContent = summaryHeader.nextElementSibling;
  summaryContent.style.display = "none";
  summaryHeader.classList.add("collapsed");

  summaryHeader.addEventListener("click", function() {
    summaryContent.style.display = summaryContent.style.display === "block" ? "none" : "block";
    summaryHeader.classList.toggle("collapsed", summaryContent.style.display === "none");
  });

  const amenitiesDropdown = document.getElementById('amenitiesDropdown');
  const amenitiesCheckboxesContainer = document.getElementById('amenitiesCheckboxesContainer');
  const amenitiesCheckboxes = amenitiesCheckboxesContainer.querySelectorAll('input[type="checkbox"]');

  amenitiesDropdown.addEventListener('click', () => {
    amenitiesCheckboxesContainer.classList.toggle('show');
  });

  function updateAmenitiesDropdownLabel() {
    const selectedCount = Array.from(amenitiesCheckboxes).filter(checkbox => checkbox.checked).length;
    amenitiesDropdown.textContent = `${selectedCount} selected`;
  }

  amenitiesCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateAmenitiesDropdownLabel);
  });

  updateAmenitiesDropdownLabel();

  amenitiesCheckboxesContainer.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  window.addEventListener('click', (event) => {
    if (!event.target.matches('#amenitiesDropdown')) {
      if (amenitiesCheckboxesContainer.classList.contains('show')) {
        amenitiesCheckboxesContainer.classList.remove('show');
      }
    }
  });

  document.querySelectorAll('.legend-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateFeatureVisibility);
  });
  createStaticLegendControls();
  updateFilterValues();
});

map.on('zoomend', () => {
  if (ScoresLayer) {
    drawSelectedAmenities(selectedScoresAmenities);
  } else if (AmenitiesCatchmentLayer) {
    drawSelectedAmenities(selectedAmenitiesAmenities);
  } else {
    drawSelectedAmenities([]);
  }
});

function initializeSliders(sliderElement, updateCallback) {
  if (sliderElement.noUiSlider) {
    return;
  }

  noUiSlider.create(sliderElement, {
    start: ['',''],
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
  if (step >= 10) {
    return Math.round(value / 10) * 10;
  } else if (step >= 1) {
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

      let popupContent = `<strong>Hex_ID:</strong> ${hexId}<br><strong>${scoreLabel}:</strong> ${score}<br><strong>Score Percentile:</strong> ${percentile}<br><strong>Population:</strong> ${population}<br><strong>IMD:</strong> ${imd}<br><strong>Car Availability:</strong> ${carAvailability}<br><strong>Future Dwellings:</strong> ${futureDwellings}`;

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
      if (range.includes('<=') && !range.includes('>') && value <= parseFloat(range.split('<=')[1]) / 100 && !isChecked) {
        return false;
      } else if (range.includes('>=') && !range.includes('<') && value >= parseFloat(range.split('>=')[1]) / 100 && !isChecked) {
        return false;
      } else if (range.includes('>') && range.includes('<=') && value > parseFloat(range.split('>')[1]) / 100 && value <= parseFloat(range.split('<=')[1]) / 100 && !isChecked) {
        return false;
      } else if (range.includes('>=') && range.includes('<') && value >= parseFloat(range.split('>=')[1]) / 100 && value < parseFloat(range.split('<')[1]) / 100 && !isChecked) {
        return false;
      } else if (range.includes('>') && range.includes('<') && value > parseFloat(range.split('>')[1]) / 100 && value < parseFloat(range.split('<')[1]) / 100 && !isChecked) {
        return false;
      } else if (range === '= 0' && value === 0 && !isChecked) {
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

function updateFeatureVisibility() {
  const updateLayerVisibility = (layer, getValue, selectedYear, attribute) => {
    layer.eachLayer(layer => {
      const feature = layer.feature;
      const value = getValue(feature);
      const isVisible = isClassVisible(value, selectedYear);

      if (layer.options._originalFillOpacity === undefined) {
        layer.options._originalFillOpacity = layer.options.fillOpacity;
      }
      layer.setStyle({ 
        opacity: isVisible ? 1 : 0, 
        fillOpacity: isVisible ? layer.options._originalFillOpacity : 0 
      });
    });
  };

  const selectedYear = AmenitiesCatchmentLayer ? AmenitiesYear.value : ScoresYear.value;
  if (AmenitiesCatchmentLayer) {
    updateLayerVisibility(AmenitiesCatchmentLayer, feature => hexTimeMap[feature.properties.Hex_ID], selectedYear, 'time');
  } else if (ScoresLayer) {
    const fieldToDisplay = selectedYear.includes('-') 
      ? `${ScoresPurpose.value}_${ScoresMode.value}` 
      : `${ScoresPurpose.value}_${ScoresMode.value}_100`;
    updateLayerVisibility(ScoresLayer, feature => feature.properties[fieldToDisplay], selectedYear, fieldToDisplay);
  }
}

function updateLegend() {
  const selectedYear = AmenitiesCatchmentLayer ? AmenitiesYear.value : ScoresYear.value;
  const legendContent = document.getElementById("legend-content");

  const checkboxStates = {};
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  legendCheckboxes.forEach(checkbox => {
    checkboxStates[checkbox.getAttribute('data-range')] = checkbox.checked;
  });

  legendContent.innerHTML = '';

  if (!ScoresLayer && !AmenitiesCatchmentLayer) {
    return;
  }

  let headerText;
  let classes;

  if (AmenitiesCatchmentLayer) {
    headerText = "Journey Time Catchment (minutes)";
    classes = [
      { range: `> 0 and <= 5`, color: "#fde725" },
      { range: `> 5 and <= 10`, color: "#7ad151" },
      { range: `> 10 and <= 15`, color: "#23a884" },
      { range: `> 15 and <= 20`, color: "#2a788e" },
      { range: `> 20 and <= 25`, color: "#414387" },
      { range: `> 25 and <= 30`, color: "#440154" }
    ];
  } else if (ScoresLayer) {
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
      updateFeatureVisibility();
    });
  });

  const masterCheckbox = document.getElementById('masterCheckbox');
  masterCheckbox.addEventListener('change', () => {
    const isChecked = masterCheckbox.checked;
    newLegendCheckboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    updateFeatureVisibility();
  });
  updateMasterCheckbox();
}

function createStaticLegendControls() {
  const legendContainer = document.getElementById("legend-extra");
  if (!legendContainer) return;

  legendContainer.innerHTML = '';

  const amenitiesCheckboxDiv = document.createElement("div");
  amenitiesCheckboxDiv.innerHTML = `<input type="checkbox" id="amenitiesCheckbox"> <span style="font-size: 1em;">Amenities</span>`;
  legendContainer.appendChild(amenitiesCheckboxDiv);
  const amenitiesCheckbox = document.getElementById('amenitiesCheckbox');
  amenitiesCheckbox.addEventListener('change', () => {
    if (amenitiesCheckbox.checked) {
      amenitiesLayerGroup.addTo(map);
    } else {
      map.removeLayer(amenitiesLayerGroup);
    }
  });

  const headerDiv = document.createElement("div");
  headerDiv.innerHTML = "Geographies";
  headerDiv.style.fontSize = "1.1em";
  headerDiv.style.marginBottom = "10px";
  legendContainer.appendChild(headerDiv);

  const wardBoundariesCheckboxDiv = document.createElement("div");
  wardBoundariesCheckboxDiv.innerHTML = `<input type="checkbox" id="wardBoundariesCheckbox"> <span style="font-size: 1em;">Ward Boundaries (2021)</span>`;
  legendContainer.appendChild(wardBoundariesCheckboxDiv);
  const wardBoundariesCheckbox = document.getElementById('wardBoundariesCheckbox');
  wardBoundariesCheckbox.addEventListener('change', () => {
    if (wardBoundariesCheckbox.checked) {
      wardBoundariesLayer.addTo(map);
    } else {
      map.removeLayer(wardBoundariesLayer);
    }
  });

  const lsoaCheckboxDiv = document.createElement("div");
  lsoaCheckboxDiv.innerHTML = `<input type="checkbox" id="lsoaCheckbox"> <span style="font-size: 1em;">Lower Layer Super Output Areas (LSOA 2021)</span>`;
  legendContainer.appendChild(lsoaCheckboxDiv);
  const lsoaCheckbox = document.getElementById('lsoaCheckbox');
  lsoaCheckbox.addEventListener('change', () => {
    if (lsoaCheckbox.checked) {
      lsoaLayer.addTo(map);
    } else {
      map.removeLayer(lsoaLayer);
    }
  });

  const GrowthZonesCheckboxDiv = document.createElement("div");
  GrowthZonesCheckboxDiv.innerHTML = `<input type="checkbox" id="GrowthZonesCheckbox"> <span style="font-size: 1em;">Growth Zones</span>`;
  legendContainer.appendChild(GrowthZonesCheckboxDiv);
  const GrowthZonesCheckbox = document.getElementById('GrowthZonesCheckbox');
  GrowthZonesCheckbox.addEventListener('change', () => {
    if (GrowthZonesCheckbox.checked) {
      GrowthZonesLayer.addTo(map);
    } else {
      map.removeLayer(GrowthZonesLayer);
    }
  });
}

function updateMasterCheckbox() {
  const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
  const allChecked = Array.from(newLegendCheckboxes).every(checkbox => checkbox.checked);
  const noneChecked = Array.from(newLegendCheckboxes).every(checkbox => !checkbox.checked);
  const masterCheckbox = document.getElementById('masterCheckbox');
  masterCheckbox.checked = allChecked;
  masterCheckbox.indeterminate = !allChecked && !noneChecked;
}

function drawSelectedAmenities(amenities) {
  const amenitiesCheckbox = document.getElementById('amenitiesCheckbox');
  amenitiesLayerGroup.clearLayers();

  if (!amenitiesCheckbox) {
    return;
  }

  if (amenities.length === 0) {
    amenities = Object.keys(amenityLayers);
  }

  const currentZoom = map.getZoom();
  const minZoomLevel = 14;

  amenities.forEach(amenity => {
    const amenityLayer = amenityLayers[amenity];
    if (amenityLayer) {
      const layer = L.geoJSON(amenityLayer, {
        pointToLayer: (feature, latlng) => {
          const icon = currentZoom >= minZoomLevel ? amenityIcons[amenity] : L.divIcon({ className: 'fa-icon', html: '<div class="dot"></div>', iconSize: [5, 5], iconAnchor: [5, 5] });
          return L.marker(latlng, { icon: icon });
        },
        onEachFeature: (feature, layer) => {
          const popupContent = AmenitiesPopup(amenity, feature.properties);
          layer.bindPopup(popupContent);

          if (selectingFromMap) {
            layer.on('click', () => {
              const index = selectedAmenitiesFromMap.indexOf(feature.properties.COREID);
              if (index === -1) {
                selectedAmenitiesFromMap.push(feature.properties.COREID);
                layer.setIcon(L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-map-marker-alt" style="color: red;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }));
              } else {
                selectedAmenitiesFromMap.splice(index, 1);
                layer.setIcon(L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-map-marker-alt" style="color: grey;"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }));
              }
            });
          }
        }
      });
      amenitiesLayerGroup.addLayer(layer);
    }
  });
}

function AmenitiesPopup(amenity, properties) {
  let amenityType;
  let name;

  switch (amenity) {
    case 'PriSch':
      amenityType = 'Primary School';
      name = properties.Establis_1;
      break;
    case 'SecSch':
      amenityType = 'Secondary School';
      name = properties.Establis_1;
      break;
    case 'FurEd':
      amenityType = 'Further Education';
      name = properties.Establis_1;
      break;
    case 'Em500':
      amenityType = 'Employment (500+ employees)';
      name = `${properties.LSOA11CD}, ${properties.LSOA11NM}`;
      break;
    case 'Em5000':
      amenityType = 'Employment (5000+ employees)';
      name = `${properties.LSOA11CD}, ${properties.LSOA11NM}`;
      break;
    case 'StrEmp':
      amenityType = 'Strategic Employment';
      name = properties.NAME;
      break;
    case 'CitCtr':
      amenityType = 'City Centre';
      name = properties.District;
      break;
    case 'MajCtr':
      amenityType = 'Major Centre';
      name = properties.Name;
      break;
    case 'DisCtr':
      amenityType = 'District Centre';
      name = properties.SITE_NAME;
      break;
    case 'GP':
      amenityType = 'General Practice';
      name = properties.WECAplu_14;
      break;
    case 'Hos':
      amenityType = 'Hospital';
      name = properties.Name;
      break;
    default:
      amenityType = 'Unknown';
      name = 'Unknown';
      break;
  }

  return `<strong>Amenity Type:</strong> ${amenityType}<br><strong>Name:</strong> ${name}<br>`;
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
}

function updateOpacitySliderScoresRanges() {
  const opacityField = ScoresOpacity.value;

  if (hexes) {
    const opacityValues = opacityField !== "None" ? hexes.features.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0) : [];
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

  if (hexes) {
    const outlineValues = outlineField !== "None" ? hexes.features.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0) : [];
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
  if (AmenitiesCatchmentLayer) {
    map.removeLayer(AmenitiesCatchmentLayer);
    AmenitiesCatchmentLayer = null;
  }

  const selectedYear = ScoresYear.value;
  if (!selectedYear) {
    updateLegend();
    updateSummaryStatistics([]);
    return;
  }
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const opacityField = ScoresOpacity.value;
  const outlineField = ScoresOutline.value;

  if (ScoresLayer) {
    map.removeLayer(ScoresLayer);
    ScoresLayer = null;
  }

  const fieldToDisplay = selectedYear.includes('-') ? `${selectedPurpose}_${selectedMode}` : `${selectedPurpose}_${selectedMode}_100`;
  const selectedLayer = scoreLayers[selectedYear];

  if (selectedLayer) {
    const filteredFeatures = selectedLayer.features.filter(feature => {
      const value = feature.properties[fieldToDisplay];
      return feature.properties[fieldToDisplay] !== undefined;
    });

    let minOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[0]) : 0;
    let maxOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[1]) : 0;
    let minOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[0]) : 0;
    let maxOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[1]) : 0;

    const filteredScoresLayer = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    ScoresLayer = L.geoJSON(filteredScoresLayer, {
      style: feature => styleScoresFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacity, maxOpacity, minOutline, maxOutline, selectedYear),
      onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear, selectedPurpose, selectedMode)
    }).addTo(map);

    selectedScoresAmenities = purposeToAmenitiesMap[selectedPurpose];
    drawSelectedAmenities(selectedScoresAmenities);
    updateLegend();
    updateFeatureVisibility();
    updateSummaryStatistics(filteredFeatures);
  }

  // Update filter values when the year changes
  updateFilterValues();
  updateSummaryStatistics(getCurrentFeatures());
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
}

function updateOpacitySliderAmenitiesRanges() {
  const opacityField = AmenitiesOpacity.value;

  if (hexes) {
    const opacityValues = opacityField !== "None" ? hexes.features.map(feature => feature.properties[opacityField]).filter(value => value !== null && value !== 0) : [];
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

  if (hexes) {
    const outlineValues = outlineField !== "None" ? hexes.features.map(feature => feature.properties[outlineField]).filter(value => value !== null && value !== 0) : [];
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

function updateAmenitiesCatchmentLayer() {
  selectedAmenitiesAmenities = Array.from(AmenitiesPurpose)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);

  if (ScoresLayer) {
    map.removeLayer(ScoresLayer);
    ScoresLayer = null;
  }

  const selectedYear = AmenitiesYear.value;
  const selectedMode = AmenitiesMode.value;

  if (!selectedYear || !selectedMode || selectedAmenitiesAmenities.length === 0) {
    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }
    drawSelectedAmenities([]);
    updateLegend();
    updateSummaryStatistics([]);
    return;
  }

  hexTimeMap = {};

  const cacheKeys = selectedAmenitiesAmenities.map(amenity => `${selectedYear}_${amenity}`);
  const fetchPromises = cacheKeys.map(cacheKey => {
    if (!csvDataCache[cacheKey]) {
      const csvPath = `https://AmFa6.github.io/TAF_test/${cacheKey}_csv.csv`;
      return fetch(csvPath)
        .then(response => response.text())
        .then(csvText => {
          const csvData = Papa.parse(csvText, { header: true }).data;
          csvData.forEach(row => {
            if (row.Mode === selectedMode && (!selectingFromMap || selectedAmenitiesFromMap.includes(row.TRACC_ID))) {
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
        if (row.Mode === selectedMode && (!selectingFromMap || selectedAmenitiesFromMap.includes(row.TRACC_ID))) {
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
    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }

    const filteredFeatures = hexes.features.filter(feature => {
      const hexId = feature.properties.Hex_ID;
      const time = hexTimeMap[hexId];
      return time !== undefined;
    });

    const filteredAmenitiesCatchmentLayer = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    AmenitiesCatchmentLayer = L.geoJSON(filteredAmenitiesCatchmentLayer, {
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
      onEachFeature: (feature, layer) => onEachFeature(feature, layer, selectedYear, selectedAmenitiesAmenities.join(','), selectedMode)
    }).addTo(map);

    drawSelectedAmenities(selectedAmenitiesAmenities);

    updateLegend();
    updateFeatureVisibility();
    updateSummaryStatistics(filteredFeatures);
  });
}

function updateSummaryStatistics(features) {
  if (!ScoresLayer && !AmenitiesCatchmentLayer) {
    features = [];
  }

  if (features.length === 0) {
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('min-score').textContent = '-';
    document.getElementById('max-score').textContent = '-';
    document.getElementById('avg-percentile').textContent = '-';
    document.getElementById('min-percentile').textContent = '-';
    document.getElementById('max-percentile').textContent = '-';
    document.getElementById('total-population').textContent = '-';
    document.getElementById('min-population').textContent = '-';
    document.getElementById('max-population').textContent = '-';
    document.getElementById('avg-imd').textContent = '-';
    document.getElementById('min-imd').textContent = '-';
    document.getElementById('max-imd').textContent = '-';
    document.getElementById('avg-car-availability').textContent = '-';
    document.getElementById('min-car-availability').textContent = '-';
    document.getElementById('max-car-availability').textContent = '-';
    document.getElementById('total-future-dwellings').textContent = '-';
    document.getElementById('min-future-dwellings').textContent = '-';
    document.getElementById('max-future-dwellings').textContent = '-';
    return;
  }

  const filterType = filterTypeDropdown.value;
  const filterValue = filterValueDropdown.value;

  let filteredFeatures = features;

  if (filterType === 'Range') {
    const selectedYear = ScoresYear.value;
    const selectedPurpose = ScoresPurpose.value;
    const selectedMode = ScoresMode.value;
    const fieldToDisplay = selectedYear.includes('-') ? `${selectedPurpose}_${selectedMode}` : `${selectedPurpose}_${selectedMode}_100`;

    if (selectedYear.includes('-')) {
      const rangePattern = /([<>]=?)?\s*(-?\d+(\.\d+)?%?)/g;
      const ranges = [];
      let match;
      while ((match = rangePattern.exec(filterValue)) !== null) {
        ranges.push({ operator: match[1], value: parseFloat(match[2]) / 100 });
      }

      filteredFeatures = features.filter(feature => {
        const value = feature.properties[fieldToDisplay];
        return ranges.every(range => {
          if (range.operator === '<=') return value <= range.value;
          if (range.operator === '>=') return value >= range.value;
          if (range.operator === '<') return value < range.value;
          if (range.operator === '>') return value > range.value;
          return value === range.value;
        });
      });
    } else {
      const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
      filteredFeatures = features.filter(feature => {
        const value = feature.properties[fieldToDisplay];
        return value >= minRange && value < maxRange;
      });
    }
  } else if (filterType === 'Ward') {
    const wardLayer = wardBoundariesLayer.getLayers().find(layer => layer.feature.properties.WD21NM === filterValue);
    if (wardLayer) {
      const wardPolygon = wardLayer.toGeoJSON();
      filteredFeatures = features.filter(feature => {
        const hexPolygon = turf.polygon(feature.geometry.coordinates);
        return turf.booleanPointInPolygon(turf.center(hexPolygon), wardPolygon);
      });
    }
  } else if (filterType === 'GrowthZone') {
    const growthZoneLayer = GrowthZonesLayer.getLayers().find(layer => layer.feature.properties.Name === filterValue);
    if (growthZoneLayer) {
      const growthZonePolygon = growthZoneLayer.toGeoJSON();
      filteredFeatures = features.filter(feature => {
        const hexPolygon = turf.polygon(feature.geometry.coordinates);
        return turf.booleanPointInPolygon(turf.center(hexPolygon), growthZonePolygon);
      });
    }
  }

  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const scoreField = `${selectedPurpose}_${selectedMode}`;
  const percentileField = `${selectedPurpose}_${selectedMode}_100`;

  const metrics = {
    score: [],
    percentile: [],
    population: [],
    imd: [],
    carAvailability: [],
    futureDwellings: []
  };

  filteredFeatures.forEach(feature => {
    const properties = feature.properties;
    metrics.score.push(properties[scoreField] || 0);
    metrics.percentile.push(properties[percentileField] || 0);
    metrics.population.push(properties.pop || 0);
    metrics.imd.push(properties.imd || 0);
    metrics.carAvailability.push(properties.carav || 0);
    metrics.futureDwellings.push(properties.hh_fut || 0);
  });

  const summary = {
    avgScore: calculateWeightedAverage(metrics.score, metrics.population),
    minScore: Math.min(...metrics.score),
    maxScore: Math.max(...metrics.score),
    avgPercentile: calculateWeightedAverage(metrics.percentile, metrics.population),
    minPercentile: Math.min(...metrics.percentile),
    maxPercentile: Math.max(...metrics.percentile),
    totalPopulation: metrics.population.reduce((a, b) => a + b, 0),
    minPopulation: Math.min(...metrics.population),
    maxPopulation: Math.max(...metrics.population),
    avgImd: calculateWeightedAverage(metrics.imd, metrics.population),
    minImd: Math.min(...metrics.imd.filter((_, index) => metrics.population[index] > 0)),
    maxImd: Math.max(...metrics.imd),
    avgCarAvailability: calculateWeightedAverage(metrics.carAvailability, metrics.population),
    minCarAvailability: Math.min(...metrics.carAvailability.filter((_, index) => metrics.population[index] > 0)),
    maxCarAvailability: Math.max(...metrics.carAvailability),
    totalFutureDwellings: metrics.futureDwellings.reduce((a, b) => a + b, 0),
    minFutureDwellings: Math.min(...metrics.futureDwellings),
    maxFutureDwellings: Math.max(...metrics.futureDwellings)
  };

  const selectedYear = ScoresYear.value;
  const formatScore = value => selectedYear.includes('-') ? `${(value * 100).toFixed(1)}%` : formatValue(value, 1);

  document.getElementById('avg-score').textContent = formatScore(summary.avgScore);
  document.getElementById('min-score').textContent = formatScore(summary.minScore);
  document.getElementById('max-score').textContent = formatScore(summary.maxScore);
  document.getElementById('avg-percentile').textContent = formatValue(summary.avgPercentile, 1);
  document.getElementById('min-percentile').textContent = formatValue(summary.minPercentile, 1);
  document.getElementById('max-percentile').textContent = formatValue(summary.maxPercentile, 1);
  document.getElementById('total-population').textContent = formatValue(summary.totalPopulation, 10);
  document.getElementById('min-population').textContent = formatValue(summary.minPopulation, 10);
  document.getElementById('max-population').textContent = formatValue(summary.maxPopulation, 10);
  document.getElementById('avg-imd').textContent = formatValue(summary.avgImd, 0.1);
  document.getElementById('min-imd').textContent = formatValue(summary.minImd, 0.1);
  document.getElementById('max-imd').textContent = formatValue(summary.maxImd, 0.1);
  document.getElementById('avg-car-availability').textContent = formatValue(summary.avgCarAvailability, 0.01);
  document.getElementById('min-car-availability').textContent = formatValue(summary.minCarAvailability, 0.01);
  document.getElementById('max-car-availability').textContent = formatValue(summary.maxCarAvailability, 0.01);
  document.getElementById('total-future-dwellings').textContent = formatValue(summary.totalFutureDwellings, 10);
  document.getElementById('min-future-dwellings').textContent = formatValue(summary.minFutureDwellings, 10);
  document.getElementById('max-future-dwellings').textContent = formatValue(summary.maxFutureDwellings, 10);
}

function calculateWeightedAverage(values, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  return weightedSum / totalWeight;
}

function updateFilterValues() {
  const filterType = filterTypeDropdown.value;
  let options = [];

  if (filterType === 'Range') {
    const selectedYear = ScoresYear.value;
    if (ScoresLayer) {
      if (selectedYear.includes('-')) {
        options = [
          '<= -20%', '> -20% and <= -10%', '> -10% and < 0', '= 0', '> 0 and <= 10%', '>= 10% and < 20%', '>= 20%'
        ];
      } else {
        options = [
          '0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'
        ];
      }
    } else if (AmenitiesCatchmentLayer) {
      options = [
        '0-5', '5-10', '10-15', '15-20', '20-25', '25-30'
      ];
    }
  } else if (filterType === 'Ward') {
    options = wardBoundariesLayer ? wardBoundariesLayer.getLayers().map(layer => layer.feature.properties.WD21NM) : [];
  } else if (filterType === 'GrowthZone') {
    options = GrowthZonesLayer ? GrowthZonesLayer.getLayers().map(layer => layer.feature.properties.Name) : [];
  }

  filterValueDropdown.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join('');
}

function getCurrentFeatures() {
  if (ScoresLayer) {
    return ScoresLayer.toGeoJSON().features;
  } else if (AmenitiesCatchmentLayer) {
    return AmenitiesCatchmentLayer.toGeoJSON().features;
  }
  return [];
}
