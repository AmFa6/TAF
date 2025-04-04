const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB, © Crown copyright and database rights 2025 OS 0100059651, Contains OS data © Crown copyright [and database right] 2025.'
}).addTo(map);

const ladCodes = ['E06000022', 'E06000023', 'E06000024', 'E06000025'];
let lsoaLookup = {};

const ladCodesString = ladCodes.map(code => `'${code}'`).join(',');

function convertMultiPolygonToPolygons(geoJson) {
  const features = [];
  const featureCounts = {};
  
  geoJson.features.forEach(feature => {
    const name = feature.properties.LAD24NM || feature.properties.WD24NM || feature.properties.LSOA21NM || 'Unknown';
    featureCounts[name] = (featureCounts[name] || 0) + 1;
    
    if (feature.geometry.type === 'MultiPolygon') {      
      const parts = feature.geometry.coordinates.map((polygonCoords, index) => {
        const area = turf.area(turf.polygon(polygonCoords));
        return { index, area, coords: polygonCoords };
      });
      
      parts.sort((a, b) => b.area - a.area);
            
      if (name === 'North Somerset' || name === 'South Gloucestershire') {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: parts[0].coords
          },
          properties: feature.properties
        });
      } else {
        feature.geometry.coordinates.forEach(polygonCoords => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: polygonCoords
            },
            properties: feature.properties
          });
        });
      }
    } else {
      features.push(feature);
    }
  });
    
  return {
    type: 'FeatureCollection',
    features: features
  };
}

fetch(`https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?outFields=*&where=LAD24CD%20IN%20(${ladCodesString})&f=geojson`)
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    uaBoundariesLayer = convertedData;
    uaBoundariesLayer = L.geoJSON(convertedData, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 1.5,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
    updateFilterValues();
  });

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Wards_December_2024_Boundaries_UK_BGC/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson')
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    const filteredFeatures = convertedData.features.filter(feature => ladCodes.includes(feature.properties.LAD24CD));
    const wardGeoJson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    wardBoundariesLayer = L.geoJSON(wardGeoJson, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 1,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LSOA21_WD24_LAD24_EW_LU/FeatureServer/0/query?outFields=*&where=LAD24CD%20IN%20(%27E06000022%27,%27E06000023%27,%27E06000024%27,%27E06000025%27)&f=geojson')
  .then(response => response.json())
  .then(data => {
    data.features.forEach(feature => {
      const lsoaCode = feature.properties.LSOA21CD;
      lsoaLookup[lsoaCode] = true;
    });

    return fetch('https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5/FeatureServer/0/query?outFields=*&where=1%3D1&geometry=-3.073689%2C51.291726%2C-2.327195%2C51.656841&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson');
  })
  .then(response => response.json())
  .then(data => {
    const convertedData = convertMultiPolygonToPolygons(data);
    const filteredFeatures = convertedData.features.filter(feature => lsoaLookup[feature.properties.LSOA21CD]);
    const lsoaGeoJson = {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

    lsoaBoundariesLayer = L.geoJSON(lsoaGeoJson, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 0.6,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

const ScoresFiles = [
  { year: '2024', path: 'https://AmFa6.github.io/TAF_test/2024_connectscore.csv' },
  { year: '2023', path: 'https://AmFa6.github.io/TAF_test/2023_connectscore.csv' },
  { year: '2022', path: 'https://AmFa6.github.io/TAF_test/2022_connectscore.csv' },
  { year: '2019', path: 'https://AmFa6.github.io/TAF_test/2019_connectscore.csv' },
  { year: '2023-2024', path: 'https://AmFa6.github.io/TAF_test/2023-2024_connectscore.csv' },
  { year: '2019-2024', path: 'https://AmFa6.github.io/TAF_test/2019-2024_connectscore.csv' },
  { year: '2022-2023', path: 'https://AmFa6.github.io/TAF_test/2022-2023_connectscore.csv' },
  { year: '2019-2023', path: 'https://AmFa6.github.io/TAF_test/2019-2023_connectscore.csv' }, 
  { year: '2019-2022', path: 'https://AmFa6.github.io/TAF_test/2019-2022_connectscore.csv' }
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
const baseColorCensus = document.getElementById("baseColorCensus");
const CensusOpacity = document.getElementById("opacityFieldCensusDropdown");
const CensusOutline = document.getElementById("outlineFieldCensusDropdown");
const CensusOpacityRange = document.getElementById('opacityRangeCensusSlider');
const CensusOutlineRange = document.getElementById('outlineRangeCensusSlider');
const CensusInverseOpacity = document.getElementById("inverseOpacityScaleCensusButton");
const CensusInverseOutline = document.getElementById("inverseOutlineScaleCensusButton");

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

fetch('https://AmFa6.github.io/TAF_test/hexes-socioeco.geojson')
  .then(response => response.json())
  .then(data => {
    hexes = data;
    if (initialLoadComplete) {
      updateSummaryStatistics(hexes.features);
    }
  })

fetch('https://AmFa6.github.io/TAF_test/GrowthZones.geojson')
  .then(response => response.json())
  .then(data => {
    GrowthZonesLayer = L.geoJSON(data, {
      style: function (feature) {
        return {
          color: 'black',
          weight: 2,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

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
let opacityCensusOrder = 'low-to-high';
let outlineCensusOrder = 'low-to-high';
let isInverseScoresOpacity = false;
let isInverseScoresOutline = false;
let isInverseAmenitiesOpacity = false;
let isInverseAmenitiesOutline = false;
let isInverseCensusOpacity = false;
let isInverseCensusOutline = false;
let GrowthZonesLayer;
let uaBoundariesLayer;
let wardBoundariesLayer;
let lsoaBoundariesLayer;
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
let highlightLayer = null;
let initialLoadComplete = false;
let isUpdatingSliders = false;
let CensusLayer = null;
let wasAboveZoomThreshold = false;

initializeSliders(ScoresOpacityRange, updateScoresLayer);
initializeSliders(ScoresOutlineRange, updateScoresLayer);
initializeSliders(AmenitiesOpacityRange, updateAmenitiesCatchmentLayer);
initializeSliders(AmenitiesOutlineRange, updateAmenitiesCatchmentLayer);
initializeSliders(CensusOpacityRange, updateCensusLayer);
initializeSliders(CensusOutlineRange, updateCensusLayer);

ScoresYear.addEventListener("change", updateScoresLayer);
ScoresPurpose.addEventListener("change", updateScoresLayer);
ScoresMode.addEventListener("change", updateScoresLayer);
AmenitiesYear.addEventListener("change", updateAmenitiesCatchmentLayer);
AmenitiesMode.addEventListener("change", updateAmenitiesCatchmentLayer);
AmenitiesPurpose.forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    updateAmenitiesCatchmentLayer();
  });
});
ScoresOpacity.addEventListener("change", () => updateSliderRanges('Scores', 'Opacity', true));
ScoresOutline.addEventListener("change", () => updateSliderRanges('Scores', 'Outline', true));
AmenitiesOpacity.addEventListener("change", () => updateSliderRanges('Amenities', 'Opacity', true));
AmenitiesOutline.addEventListener("change", () => updateSliderRanges('Amenities', 'Outline', true));
CensusOpacity.addEventListener("change", () => updateSliderRanges('Census', 'Opacity'));
CensusOutline.addEventListener("change", () => updateSliderRanges('Census', 'Outline'));
ScoresInverseOpacity.addEventListener("click", () => toggleInverseScale('Scores', 'Opacity'));
ScoresInverseOutline.addEventListener("click", () => toggleInverseScale('Scores', 'Outline'));
AmenitiesInverseOpacity.addEventListener("click", () => toggleInverseScale('Amenities', 'Opacity'));
AmenitiesInverseOutline.addEventListener("click", () => toggleInverseScale('Amenities', 'Outline'));
CensusInverseOpacity.addEventListener("click", () => toggleInverseScale('Census', 'Opacity'));
CensusInverseOutline.addEventListener("click", () => toggleInverseScale('Census', 'Outline'));
baseColorCensus.addEventListener("change", updateCensusLayer);


filterTypeDropdown.addEventListener('change', () => {
  updateFilterValues();
  updateSummaryStatistics(getCurrentFeatures());
  
  const highlightCheckbox = document.getElementById('highlightAreaCheckbox');
  if (filterTypeDropdown.value === 'Range') {
    highlightCheckbox.disabled = true;
    highlightCheckbox.checked = false;
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
  } else {
    highlightCheckbox.disabled = false;
  }
  
  if (document.getElementById('highlightAreaCheckbox').checked) {
    highlightSelectedArea();
  }
});
filterValueDropdown.addEventListener('change', () => {
  updateSummaryStatistics(getCurrentFeatures());
  if (document.getElementById('highlightAreaCheckbox').checked) {
    highlightSelectedArea();
  }
});
document.getElementById('highlightAreaCheckbox').addEventListener('change', function() {
  if (this.checked) {
    highlightSelectedArea();
  } else {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
  }
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
          if (otherHeader.textContent.includes("Connectivity Scores")) {
            if(ScoresLayer) {
              map.removeLayer(ScoresLayer);
              ScoresLayer = null;
            }
          } else if (otherHeader.textContent.includes("Journey Time Catchments - Amenities")) {
            if(AmenitiesCatchmentLayer) {
              map.removeLayer(AmenitiesCatchmentLayer);
              AmenitiesCatchmentLayer = null;
            }
          } else if (otherHeader.textContent.includes("Census / Local Plan Data")) {
            if(CensusLayer) {
              map.removeLayer(CensusLayer);
              CensusLayer = null;
            }
          }
        }
      });
      panelContent.style.display = panelContent.style.display === "block" ? "none" : "block";
      header.classList.toggle("collapsed", panelContent.style.display === "none");

      if (panelContent.style.display === "block") {
        if (header.textContent.includes("Connectivity Scores")) {
          updateScoresLayer();
        } else if (header.textContent.includes("Journey Time Catchments - Amenities")) {
          updateAmenitiesCatchmentLayer();
        } else if (header.textContent.includes("Census / Local Plan Data")) {
          updateCensusLayer();
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
        if(CensusLayer) {
          map.removeLayer(CensusLayer);
          CensusLayer = null;
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
  
    const uaBoundariesCheckboxDiv = document.createElement("div");
    uaBoundariesCheckboxDiv.innerHTML = `<input type="checkbox" id="uaBoundariesCheckbox"> <span style="font-size: 1em;">UA Boundaries (2024)</span>`;
    legendContainer.appendChild(uaBoundariesCheckboxDiv);
    const uaBoundariesCheckbox = document.getElementById('uaBoundariesCheckbox');
    uaBoundariesCheckbox.addEventListener('change', () => {
      if (uaBoundariesCheckbox.checked) {
        uaBoundariesLayer.setStyle({ opacity: 1 });
      } else {
        uaBoundariesLayer.setStyle({ opacity: 0 });
      }
    });
  
    const wardBoundariesCheckboxDiv = document.createElement("div");
    wardBoundariesCheckboxDiv.innerHTML = `<input type="checkbox" id="wardBoundariesCheckbox"> <span style="font-size: 1em;">Ward Boundaries (2024)</span>`;
    legendContainer.appendChild(wardBoundariesCheckboxDiv);
    const wardBoundariesCheckbox = document.getElementById('wardBoundariesCheckbox');
    wardBoundariesCheckbox.addEventListener('change', () => {
      if (wardBoundariesCheckbox.checked) {
        wardBoundariesLayer.setStyle({ opacity: 1 });
      } else {
        wardBoundariesLayer.setStyle({ opacity: 0});
      }
    });
  
    const lsoaCheckboxDiv = document.createElement("div");
    lsoaCheckboxDiv.innerHTML = `<input type="checkbox" id="lsoaCheckbox"> <span style="font-size: 1em;">Lower Layer Super Output Areas (LSOA 2021)</span>`;
    legendContainer.appendChild(lsoaCheckboxDiv);
    const lsoaCheckbox = document.getElementById('lsoaCheckbox');
    lsoaCheckbox.addEventListener('change', () => {
      if (lsoaCheckbox.checked) {
        lsoaBoundariesLayer.setStyle({ opacity: 1 });
      } else {
        lsoaBoundariesLayer.setStyle({ opacity: 0 });
      }
    });
  
    const GrowthZonesCheckboxDiv = document.createElement("div");
    GrowthZonesCheckboxDiv.innerHTML = `<input type="checkbox" id="GrowthZonesCheckbox"> <span style="font-size: 1em;">Growth Zones</span>`;
    legendContainer.appendChild(GrowthZonesCheckboxDiv);
    const GrowthZonesCheckbox = document.getElementById('GrowthZonesCheckbox');
    GrowthZonesCheckbox.addEventListener('change', () => {
      if (GrowthZonesCheckbox.checked) {
        GrowthZonesLayer.setStyle({ opacity: 1 });
      } else {
        GrowthZonesLayer.setStyle({ opacity: 0 });
      }
    });
  }
  
  createStaticLegendControls();
  updateFilterValues();
  
  document.getElementById('metric-row-1').textContent = '-';
  document.getElementById('metric-row-2').textContent = '-';
  document.getElementById('avg-score').textContent = '-';
  document.getElementById('min-score').textContent = '-';
  document.getElementById('max-score').textContent = '-';
  document.getElementById('avg-percentile').textContent = '-';
  document.getElementById('min-percentile').textContent = '-';
  document.getElementById('max-percentile').textContent = '-';
  document.getElementById('total-population').textContent = '-';
  document.getElementById('min-population').textContent = '-';
  document.getElementById('max-population').textContent = '-';
  document.getElementById('avg-imd-score').textContent = '-';
  document.getElementById('min-imd-score').textContent = '-';
  document.getElementById('max-imd-score').textContent = '-';
  document.getElementById('avg-imd-decile').textContent = '-';
  document.getElementById('min-imd-decile').textContent = '-';
  document.getElementById('max-imd-decile').textContent = '-';
  document.getElementById('avg-car-availability').textContent = '-';
  document.getElementById('min-car-availability').textContent = '-';
  document.getElementById('max-car-availability').textContent = '-';
  document.getElementById('total-growth-pop').textContent = '-';
  document.getElementById('min-growth-pop').textContent = '-';
  document.getElementById('max-growth-pop').textContent = '-';

  initialLoadComplete = true;
});

map.on('zoomend', () => {
  const currentZoom = map.getZoom();
  const isAboveZoomThreshold = currentZoom >= 14;
  
  if (isAboveZoomThreshold !== wasAboveZoomThreshold) {
    wasAboveZoomThreshold = isAboveZoomThreshold;
    
    if (ScoresLayer) {
      drawSelectedAmenities(selectedScoresAmenities);
    } else if (AmenitiesCatchmentLayer) {
      drawSelectedAmenities(selectedAmenitiesAmenities);
    } else {
      drawSelectedAmenities([]);
    }
  }
});

map.on('click', function (e) {
  const clickedLatLng = e.latlng;
  const clickedPoint = turf.point([clickedLatLng.lng, clickedLatLng.lat]);
  const popupContent = {
    Geographies: [],
    Amenities: [],
    Hexagon: []
  };

  if (uaBoundariesLayer) {
    uaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>Local Authority:</strong> ${layer.feature.properties.LAD24NM}`);
      }
    });
  }

  if (wardBoundariesLayer) {
    wardBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>Ward:</strong> ${layer.feature.properties.WD24NM}`);
      }
    });
  }

  if (lsoaBoundariesLayer) {
    lsoaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>LSOA:</strong> ${layer.feature.properties.LSOA21NM}`);
      }
    });
  }

  if (GrowthZonesLayer) {
    GrowthZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>Growth Zone:</strong> ${layer.feature.properties.Name}`);
      }
    });
  }

  amenitiesLayerGroup.eachLayer(featureGroup => {
    featureGroup.eachLayer(layer => {
      if (layer.getLatLng && layer.getLatLng().distanceTo(clickedLatLng) < 100) {
        if (layer.feature && layer.feature.properties) {
          const properties = layer.feature.properties;
          const amenityContent = getAmenityPopupContent(layer._amenityType, properties);
          popupContent.Amenities.push(amenityContent);
        }
      }
    });
  });

  if (ScoresLayer || AmenitiesCatchmentLayer) {
    const hexLayer = ScoresLayer || AmenitiesCatchmentLayer;
    hexLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        const properties = layer.feature.properties;
        if (ScoresLayer) {
          const selectedYear = ScoresYear.value;
          const selectedPurpose = ScoresPurpose.value;
          const selectedMode = ScoresMode.value;
          const fieldToDisplay = selectedYear.includes('-') ? `${selectedPurpose}_${selectedMode}` : `${selectedPurpose}_${selectedMode}_100`;
  
          const scoreValue = properties[fieldToDisplay];
          const score = selectedYear.includes('-') ? `${(scoreValue * 100).toFixed(1)}%` : formatValue(scoreValue, 1);
          const percentile = formatValue(properties[`${selectedPurpose}_${selectedMode}_100`], 1);
          const population = formatValue(properties.pop, 1);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.IMD_Decile, 1);
          const carAvailability = formatValue(properties.car_availability, 0.01);
          const growthPop = formatValue(properties.pop_growth, 1);
          const scoreLabel = selectedYear.includes('-') ? 'Score Difference' : 'Score';

          popupContent.Hexagon.push(`
            <strong>Hex_ID:</strong> ${properties.Hex_ID}<br>
            <strong>${scoreLabel}:</strong> ${score}<br>
            <strong>Percentile:</strong> ${percentile}<br>
            <strong>Population:</strong> ${population}<br>
            <strong>IMD Score:</strong> ${imdScore}<br>
            <strong>IMD Decile:</strong> ${imdDecile}<br>
            <strong>Car Availability:</strong> ${carAvailability}<br>
            <strong>Population Growth:</strong> ${growthPop}
          `);
        } else if (AmenitiesCatchmentLayer) {
          const time = formatValue(hexTimeMap[properties.Hex_ID], 1);
          const population = formatValue(properties.pop, 1);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.IMD_Decile, 1);
          const carAvailability = formatValue(properties.car_availability, 0.01);
          const growthPop = formatValue(properties.pop_growth, 1);
  
          popupContent.Hexagon.push(`
            <strong>Hex_ID:</strong> ${properties.Hex_ID}<br>
            <strong>Journey Time:</strong> ${time} minutes<br>
            <strong>Population:</strong> ${population}<br>
            <strong>IMD Score:</strong> ${imdScore}<br>
            <strong>IMD Decile:</strong> ${imdDecile}<br>
            <strong>Car Availability:</strong> ${carAvailability}<br>
            <strong>Population Growth:</strong> ${growthPop}
          `);
        }
      }
    });
  } else if (hexes) {
    hexes.features.forEach(feature => {
      const polygon = turf.polygon(feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        const properties = feature.properties;
        const population = formatValue(properties.pop, 1);
        const imdScore = formatValue(properties.IMDScore, 0.1);
        const imdDecile = formatValue(properties.IMD_Decile, 1);
        const carAvailability = formatValue(properties.car_availability, 0.01);
        const growthPop = formatValue(properties.pop_growth, 1);
  
        popupContent.Hexagon.push(`
          <strong>Hex_ID:</strong> ${properties.Hex_ID}<br>
          <strong>Population:</strong> ${population}<br>
          <strong>IMD Score:</strong> ${imdScore}<br>
          <strong>IMD Decile:</strong> ${imdDecile}<br>
          <strong>Car Availability:</strong> ${carAvailability}<br>
          <strong>Population Growth:</strong> ${growthPop}
        `);
      }
    });
  }

  const content = `
    <div>
      <h4>Geographies</h4>
      ${popupContent.Geographies.length > 0 ? popupContent.Geographies.join('<br>') : '-'}
      <h4>Amenities</h4>
      ${popupContent.Amenities.length > 0 ? popupContent.Amenities.join('<br>') : '-'}
      <h4>Hexagon</h4>
      ${popupContent.Hexagon.length > 0 ? popupContent.Hexagon.join('<br>') : '-'}
    </div>
  `;

  L.popup()
    .setLatLng(clickedLatLng)
    .setContent(content)
    .openOn(map);
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function isPanelOpen(panelName) {
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
  for (const header of panelHeaders) {
    if (header.textContent.includes(panelName) && !header.classList.contains("collapsed")) {
      return true;
    }
  }
  return false;
}

function configureSlider(sliderElement, updateCallback, isInverse, order, debounceDelay = 250) {
  const debouncedUpdateCallback = debounce(updateCallback, debounceDelay);

  sliderElement.noUiSlider.off();
  
  const handles = sliderElement.querySelectorAll('.noUi-handle');
  const connectElements = sliderElement.querySelectorAll('.noUi-connect');

  handles.forEach(handle => {
    handle.classList.remove('noUi-handle-transparent');
  });
  connectElements.forEach(connect => {
    connect.classList.remove('noUi-connect-dark-grey', 'noUi-connect-gradient-right', 'noUi-connect-gradient-left');
  });

  if (isInverse) {
    sliderElement.noUiSlider.updateOptions({
      connect: [true, true, true]
    }, false);
    handles[1].classList.add('noUi-handle-transparent');
    handles[0].classList.remove('noUi-handle-transparent');
    connectElements[0].classList.add('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-right');
    connectElements[1].classList.add('noUi-connect-gradient-left');
    connectElements[2].classList.remove('noUi-connect-dark-grey');
  } else {
    sliderElement.noUiSlider.updateOptions({
      connect: [true, true, true]
    }, false);
    handles[1].classList.remove('noUi-handle-transparent');
    handles[0].classList.add('noUi-handle-transparent');
    connectElements[0].classList.remove('noUi-connect-dark-grey');
    connectElements[1].classList.remove('noUi-connect-gradient-left');
    connectElements[1].classList.add('noUi-connect-gradient-right');
    connectElements[2].classList.add('noUi-connect-dark-grey');
  }

  sliderElement.noUiSlider.on('update', function (values, handle) {
    const handleElement = handles[handle];
    handleElement.setAttribute('data-value', formatValue(values[handle], sliderElement.noUiSlider.options.step));
    debouncedUpdateCallback();
  });
}

function toggleInverseScale(type, scaleType) {
  isUpdatingSliders = true;

  let isInverse, rangeElement, order;

  if (type === 'Scores') {
    if (scaleType === 'Opacity') {
      isInverseScoresOpacity = !isInverseScoresOpacity;
      isInverse = isInverseScoresOpacity;
      rangeElement = ScoresOpacityRange;
      opacityScoresOrder = isInverse ? 'high-to-low' : 'low-to-high';
    } else if (scaleType === 'Outline') {
      isInverseScoresOutline = !isInverseScoresOutline;
      isInverse = isInverseScoresOutline;
      rangeElement = ScoresOutlineRange;
      outlineScoresOrder = isInverse ? 'high-to-low' : 'low-to-high';
    }
  } else if (type === 'Amenities') {
    if (scaleType === 'Opacity') {
      isInverseAmenitiesOpacity = !isInverseAmenitiesOpacity;
      isInverse = isInverseAmenitiesOpacity;
      rangeElement = AmenitiesOpacityRange;
      opacityAmenitiesOrder = isInverse ? 'high-to-low' : 'low-to-high';
    } else if (scaleType === 'Outline') {
      isInverseAmenitiesOutline = !isInverseAmenitiesOutline;
      isInverse = isInverseAmenitiesOutline;
      rangeElement = AmenitiesOutlineRange;
      outlineAmenitiesOrder = isInverse ? 'high-to-low' : 'low-to-high';
    }
  } else if (type === 'Census') {
    if (scaleType === 'Opacity') {
      isInverseCensusOpacity = !isInverseCensusOpacity;
      isInverse = isInverseCensusOpacity;
      rangeElement = CensusOpacityRange;
      opacityCensusOrder = isInverse ? 'high-to-low' : 'low-to-high';
    } else if (scaleType === 'Outline') {
      isInverseCensusOutline = !isInverseCensusOutline;
      isInverse = isInverseCensusOutline;
      rangeElement = CensusOutlineRange;
      outlineCensusOrder = isInverse ? 'high-to-low' : 'low-to-high';
    }
  }

  const currentValues = rangeElement.noUiSlider.get();
  
  configureSlider(
    rangeElement,
    type === 'Scores' ? updateScoresLayer :
    type === 'Amenities' ? updateAmenitiesCatchmentLayer :
    updateCensusLayer,
    isInverse,
    order
  );
  rangeElement.noUiSlider.set(currentValues, false);

  updateSliderRanges(type, scaleType);

  isUpdatingSliders = false;
  
  if (type === 'Scores' && isPanelOpen("Connectivity Scores")) {
    updateScoresLayer();
  } else if (type === 'Amenities' && isPanelOpen("Journey Time Catchments - Amenities")) {
    updateAmenitiesCatchmentLayer();
  } else if (type === 'Census' && isPanelOpen("Census / Local Plan Data")) {
      updateCensusLayer();
    }
}

function initializeSliders(sliderElement, updateCallback) {
  if (sliderElement.noUiSlider) {
    sliderElement.noUiSlider.destroy();
  }

  noUiSlider.create(sliderElement, {
    start: ['', ''],
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

  configureSlider(sliderElement, updateCallback, false, 'low-to-high');
}

function scaleExp(value, minVal, maxVal, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = order === 'low-to-high' ? normalizedValue : 1 - normalizedValue;
  return minScale + scaledValue * (maxScale - minScale);
}

function formatValue(value, step) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  if (step >= 10) {
    return Math.round(value / 10) * 10 !== 0 ? Math.round(value / 10) * 10 
      .toLocaleString() : '0';
  } else if (step >= 1) {
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 0.1) {
    return parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } else if (step >= 0.01) {
    return parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return parseFloat(value).toString();
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

      if (layer.options._originalStyling === undefined) {
        layer.options._originalStyling = {
          opacity: layer.options.opacity,
          fillOpacity: layer.options.fillOpacity
        };
      }

      if (isVisible) {
        layer.setStyle({ 
          opacity: layer.options._originalStyling.opacity, 
          fillOpacity: layer.options._originalStyling.fillOpacity 
        });
      } else {
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
      }
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

  function updateMasterCheckbox() {
    const newLegendCheckboxes = document.querySelectorAll('.legend-checkbox');
    const allChecked = Array.from(newLegendCheckboxes).every(checkbox => checkbox.checked);
    const noneChecked = Array.from(newLegendCheckboxes).every(checkbox => !checkbox.checked);
    const masterCheckbox = document.getElementById('masterCheckbox');
    masterCheckbox.checked = allChecked;
    masterCheckbox.indeterminate = !allChecked && !noneChecked;
  }

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

function getAmenityPopupContent(amenityType, properties) {
  let amenityName = 'Unknown';
  let amenityTypeDisplay = 'Unknown';
  
  if (amenityType === 'PriSch') {
    amenityTypeDisplay = 'Primary School';
    amenityName = properties.Establis_1 || properties.Name || 'Unknown';
  } else if (amenityType === 'SecSch') {
    amenityTypeDisplay = 'Secondary School';
    amenityName = properties.Establis_1 || properties.Name || 'Unknown';
  } else if (amenityType === 'FurEd') {
    amenityTypeDisplay = 'Further Education';
    amenityName = properties.Establis_1 || properties.Name || 'Unknown';
  } else if (amenityType === 'Em500') {
    amenityTypeDisplay = 'Employment (500+ employees)';
    amenityName = properties.LSOA11CD && properties.LSOA11NM ? 
                 `${properties.LSOA11CD}, ${properties.LSOA11NM}` : 
                 properties.Name || 'Unknown';
  } else if (amenityType === 'Em5000') {
    amenityTypeDisplay = 'Employment (5000+ employees)';
    amenityName = properties.LSOA11CD && properties.LSOA11NM ? 
                 `${properties.LSOA11CD}, ${properties.LSOA11NM}` : 
                 properties.Name || 'Unknown';
  } else if (amenityType === 'StrEmp') {
    amenityTypeDisplay = 'Strategic Employment';
    amenityName = properties.NAME || properties.Name || 'Unknown';
  } else if (amenityType === 'CitCtr') {
    amenityTypeDisplay = 'City Centre';
    amenityName = properties.District || properties.Name || 'Unknown';
  } else if (amenityType === 'MajCtr') {
    amenityTypeDisplay = 'Major Centre';
    amenityName = properties.Name || 'Unknown';
  } else if (amenityType === 'DisCtr') {
    amenityTypeDisplay = 'District Centre';
    amenityName = properties.SITE_NAME || properties.Name || 'Unknown';
  } else if (amenityType === 'GP') {
    amenityTypeDisplay = 'General Practice';
    amenityName = properties.WECAplu_14 || properties.Name || 'Unknown';
  } else if (amenityType === 'Hos') {
    amenityTypeDisplay = 'Hospital';
    amenityName = properties.Name || 'Unknown';
  }
  return `<strong>Amenity:</strong> ${amenityName} (${amenityTypeDisplay})`;
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
  const isAboveZoomThreshold = currentZoom >= 14;

  amenities.forEach(amenity => {
    const amenityLayer = amenityLayers[amenity];
    if (amenityLayer) {
      const layer = L.geoJSON(amenityLayer, {
        pointToLayer: (feature, latlng) => {
          const icon = isAboveZoomThreshold ? 
            amenityIcons[amenity] : 
            L.divIcon({ className: 'fa-icon', html: '<div class="dot"></div>', iconSize: [5, 5], iconAnchor: [5, 5] });
          const marker = L.marker(latlng, { icon: icon });
          marker._amenityType = amenity;
          return marker;
        },
      });
      amenitiesLayerGroup.addLayer(layer);
    }
  });
}

function updateSliderRanges(type, scaleType, skipLayerUpdate = false) {
  if (isUpdatingSliders) return;
  isUpdatingSliders = true;

  let field, rangeElement, minElement, maxElement, hexesData, order, isInverse;

  if (type === 'Scores') {
    if (scaleType === 'Opacity') {
      field = ScoresOpacity.value;
      rangeElement = ScoresOpacityRange;
      minElement = document.getElementById('opacityRangeScoresMin');
      maxElement = document.getElementById('opacityRangeScoresMax');
      hexesData = hexes;
      order = opacityScoresOrder;
      isInverse = isInverseScoresOpacity;
    } else if (scaleType === 'Outline') {
      field = ScoresOutline.value;
      rangeElement = ScoresOutlineRange;
      minElement = document.getElementById('outlineRangeScoresMin');
      maxElement = document.getElementById('outlineRangeScoresMax');
      hexesData = hexes;
      order = outlineScoresOrder;
      isInverse = isInverseScoresOutline;
    }
  } else if (type === 'Amenities') {
    if (scaleType === 'Opacity') {
      field = AmenitiesOpacity.value;
      rangeElement = AmenitiesOpacityRange;
      minElement = document.getElementById('opacityRangeAmenitiesMin');
      maxElement = document.getElementById('opacityRangeAmenitiesMax');
      hexesData = hexes;
      order = opacityAmenitiesOrder;
      isInverse = isInverseAmenitiesOpacity;
    } else if (scaleType === 'Outline') {
      field = AmenitiesOutline.value;
      rangeElement = AmenitiesOutlineRange;
      minElement = document.getElementById('outlineRangeAmenitiesMin');
      maxElement = document.getElementById('outlineRangeAmenitiesMax');
      hexesData = hexes;
      order = outlineAmenitiesOrder;
      isInverse = isInverseAmenitiesOutline;
    }
  } else if (type === 'Census') {
    if (scaleType === 'Opacity') {
      field = CensusOpacity.value;
      rangeElement = CensusOpacityRange;
      minElement = document.getElementById('opacityRangeCensusMin');
      maxElement = document.getElementById('opacityRangeCensusMax');
      hexesData = hexes;
      order = opacityCensusOrder;
      isInverse = isInverseCensusOpacity;
    } else if (scaleType === 'Outline') {
      field = CensusOutline.value;
      rangeElement = CensusOutlineRange;
      minElement = document.getElementById('outlineRangeCensusMin');
      maxElement = document.getElementById('outlineRangeCensusMax');
      hexesData = hexes;
      order = outlineCensusOrder;
      isInverse = isInverseCensusOutline;
    }
  }

  if (!rangeElement || !rangeElement.noUiSlider) {
    console.error(`Slider not initialized for ${type} ${scaleType}`);
    isUpdatingSliders = false;
    return;
  }

  if (hexesData) {
    const values = field !== "None" ? hexesData.features.map(feature => feature.properties[field]).filter(value => value !== null && value !== 0) : [];
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const roundedMaxValue = Math.pow(10, Math.ceil(Math.log10(maxValue)));
    let step = roundedMaxValue / 100;

    if (isNaN(step) || step <= 0) {
      step = 1;
    }

    const adjustedMaxValue = Math.ceil(maxValue / step) * step;
    const adjustedMinValue = Math.floor(minValue / step) * step;

    if (field === "None") {
      rangeElement.setAttribute('disabled', true);
      rangeElement.noUiSlider.updateOptions({
        range: {
          'min': 0,
          'max': 0
        },
        step: 1
      }, false);
      rangeElement.noUiSlider.set(['', ''], false);
      minElement.innerText = '';
      maxElement.innerText = '';
    } else {
      rangeElement.removeAttribute('disabled');
      rangeElement.noUiSlider.updateOptions({
        range: {
          'min': adjustedMinValue,
          'max': adjustedMaxValue
        },
        step: step
      }, false);
      rangeElement.noUiSlider.set([adjustedMinValue, adjustedMaxValue], false);
      minElement.innerText = formatValue(adjustedMinValue, step);
      maxElement.innerText = formatValue(adjustedMaxValue, step);
    }

    configureSlider(
      rangeElement,
      type === 'Scores' ? () => updateScoresLayer(true) :
      type === 'Amenities' ? () => updateAmenitiesCatchmentLayer(true) :
      () => updateCensusLayer(),
      isInverse,
      order
    );
  }

  isUpdatingSliders = false;

  if (!skipLayerUpdate) {
    if (type === 'Scores') {
      updateScoresLayer(true);
    } else if (type === 'Amenities') {
      updateAmenitiesCatchmentLayer(true);
    } else if (type === 'Census') {
      updateCensusLayer();
    }
  }
}

function styleScoresFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacityValue, maxOpacityValue, minOutlineValue, maxOutlineValue, selectedYear) {
  const value = feature.properties[fieldToDisplay];
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
  const color = getColor(parseFloat(value), selectedYear);

  let opacity;
  if (opacityField === 'None') {
    opacity = 0.5;
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

  const style = {
    fillColor: color,
    weight: weight,
    opacity: 1,
    color: 'black',
    fillOpacity: opacity
  };

  return style;
}

function updateScoresLayer(stylingUpdateOnly = false) {
  if (!initialLoadComplete || !isPanelOpen("Connectivity Scores")) {
    return;
  }

  console.log("Updating ScoresLayer.");

  const selectedYear = ScoresYear.value;
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const opacityField = ScoresOpacity.value;
  const outlineField = ScoresOutline.value;

  if (!selectedYear) {
    updateLegend();
    updateSummaryStatistics([]);
    return;
  }

  const currentYear = ScoresLayer ? ScoresLayer._currentYear : null;
  
  if (currentYear !== selectedYear) {
    stylingUpdateOnly = false;
  }

  const fieldToDisplay = selectedYear.includes('-') ? `${selectedPurpose}_${selectedMode}` : `${selectedPurpose}_${selectedMode}_100`;

  if (!scoreLayers[selectedYear]) {
    const scoreFile = ScoresFiles.find(file => file.year === selectedYear);
    if (scoreFile) {
      fetch(scoreFile.path)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(csvData => {
          const parsedData = Papa.parse(csvData, { header: true }).data;
          scoreLayers[selectedYear] = parsedData;
          updateScoresLayer(false);
        })
        .catch(error => {
        });
      return;
    } else {
      return;
    }
  }

  const selectedCsvData = scoreLayers[selectedYear];
  if (!selectedCsvData) {
    return;
  }

  const scoreLookup = {};
  selectedCsvData.forEach(row => {
    if (row.Hex_ID && row[fieldToDisplay] !== undefined) {
      scoreLookup[row.Hex_ID] = row;
    }
  });

  if (!stylingUpdateOnly || !ScoresLayer) {
    if (ScoresLayer) {
      map.removeLayer(ScoresLayer);
      ScoresLayer = null;
    }

    const featuresWithScores = hexes.features
      .filter(feature => scoreLookup[feature.properties.Hex_ID])
      .map(feature => {
        const hexId = feature.properties.Hex_ID;
        const scoreData = scoreLookup[hexId];

        return {
          type: "Feature",
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            ...scoreData
          }
        };
      });

    const filteredScoresLayer = {
      type: "FeatureCollection",
      features: featuresWithScores
    };

    let minOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[0]) : 0;
    let maxOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[1]) : 0;
    let minOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[0]) : 0;
    let maxOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[1]) : 0;

    ScoresLayer = L.geoJSON(filteredScoresLayer, {
      style: feature => styleScoresFeature(feature, fieldToDisplay, opacityField, outlineField, minOpacity, maxOpacity, minOutline, maxOutline, selectedYear),
    }).addTo(map);
    
    ScoresLayer._currentYear = selectedYear;

    selectedScoresAmenities = purposeToAmenitiesMap[selectedPurpose];
    drawSelectedAmenities(selectedScoresAmenities);
    updateLegend();
    updateFeatureVisibility();
    updateFilterValues();
    updateSummaryStatistics(getCurrentFeatures());
    highlightSelectedArea();
    return;
  }

  let minOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[0]) : 0;
  let maxOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? parseFloat(ScoresOpacityRange.noUiSlider.get()[1]) : 0;
  let minOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[0]) : 0;
  let maxOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? parseFloat(ScoresOutlineRange.noUiSlider.get()[1]) : 0;

  ScoresLayer.eachLayer(layer => {
    const style = styleScoresFeature(
      layer.feature, fieldToDisplay, opacityField, outlineField,
      minOpacity, maxOpacity, minOutline, maxOutline, selectedYear
    );

    layer.options._originalStyling = {
      opacity: style.opacity,
      fillOpacity: style.fillOpacity
    };

    layer.setStyle(style);
  });
  selectedScoresAmenities = purposeToAmenitiesMap[selectedPurpose];
  drawSelectedAmenities(selectedScoresAmenities);

  updateFeatureVisibility();
}

function updateAmenitiesCatchmentLayer(stylingUpdateOnly = false) {
  if (!initialLoadComplete || !isPanelOpen("Journey Time Catchments - Amenities")) {
    return;
  }
    
  if (stylingUpdateOnly && AmenitiesCatchmentLayer) {
    const minOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
      parseFloat(AmenitiesOpacityRange.noUiSlider.get()[0]) : 0;
    const maxOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
      parseFloat(AmenitiesOpacityRange.noUiSlider.get()[1]) : 0;
    const minOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
      parseFloat(AmenitiesOutlineRange.noUiSlider.get()[0]) : 0;
    const maxOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
      parseFloat(AmenitiesOutlineRange.noUiSlider.get()[1]) : 0;
    
    AmenitiesCatchmentLayer.eachLayer(layer => {
      const feature = layer.feature;
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

      let opacity;
      if (AmenitiesOpacity.value === 'None') {
        opacity = 0.5;
      } else {
        const opacityValue = feature.properties[AmenitiesOpacity.value];
        if (opacityValue === 0 || opacityValue === null || opacityValue === undefined) {
          opacity = isInverseAmenitiesOpacity ? 0.5 : 0.1;
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

      layer.options._originalStyling = {
        opacity: 1,
        fillOpacity: opacity
      };

      layer.setStyle({
        fillColor: color,
        weight: weight,
        opacity: 1,
        color: 'black',
        fillOpacity: opacity
      });
    });
    updateFeatureVisibility();
    return;
  }
  
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

    const minOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
      parseFloat(AmenitiesOpacityRange.noUiSlider.get()[0]) : 0;
    const maxOpacityValue = AmenitiesOpacityRange && AmenitiesOpacityRange.noUiSlider ? 
      parseFloat(AmenitiesOpacityRange.noUiSlider.get()[1]) : 0;
    const minOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
      parseFloat(AmenitiesOutlineRange.noUiSlider.get()[0]) : 0;
    const maxOutlineValue = AmenitiesOutlineRange && AmenitiesOutlineRange.noUiSlider ? 
      parseFloat(AmenitiesOutlineRange.noUiSlider.get()[1]) : 0;
    
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

        let opacity;
        if (AmenitiesOpacity.value === 'None') {
          opacity = 0.5;
        } else {
          const opacityValue = feature.properties[AmenitiesOpacity.value];
          if (opacityValue === 0 || opacityValue === null || opacityValue === undefined) {
            opacity = isInverseAmenitiesOpacity ? 0.5 : 0.1;
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
    }).addTo(map);
    
    drawSelectedAmenities(selectedAmenitiesAmenities);
    updateLegend();
    updateFeatureVisibility();
    updateSummaryStatistics(filteredFeatures);
    highlightSelectedArea();
  });
}

function updateCensusLayer() {
  if (!initialLoadComplete || !isPanelOpen("Census / Local Plan Data")) {
    return;
  }

  console.log('Updating Census Layer');

  const baseColor = baseColorCensus.value;
  const opacityField = CensusOpacity.value;
  const outlineField = CensusOutline.value;

  if (ScoresLayer) {
    map.removeLayer(ScoresLayer);
    ScoresLayer = null;
  }

  if (AmenitiesCatchmentLayer) {
    map.removeLayer(AmenitiesCatchmentLayer);
    AmenitiesCatchmentLayer = null;
  }

  if (CensusLayer) {
    map.removeLayer(CensusLayer);
    CensusLayer = null;
  }

  const minOpacityValue = CensusOpacityRange && CensusOpacityRange.noUiSlider ? 
    parseFloat(CensusOpacityRange.noUiSlider.get()[0]) : 0;
  const maxOpacityValue = CensusOpacityRange && CensusOpacityRange.noUiSlider ? 
    parseFloat(CensusOpacityRange.noUiSlider.get()[1]) : 0;
  const minOutlineValue = CensusOutlineRange && CensusOutlineRange.noUiSlider ? 
    parseFloat(CensusOutlineRange.noUiSlider.get()[0]) : 0;
  const maxOutlineValue = CensusOutlineRange && CensusOutlineRange.noUiSlider ? 
    parseFloat(CensusOutlineRange.noUiSlider.get()[1]) : 0;

  CensusLayer = L.geoJSON(hexes, {
    style: function(feature) {
      let opacity;
      if (opacityField === 'None') {
        opacity = 0.5;
      } else {
        const opacityValue = feature.properties[opacityField];
        if (opacityValue === 0 || opacityValue === null || opacityValue === undefined) {
          opacity = isInverseCensusOpacity ? 0.8 : 0.1;
        } else {
          opacity = scaleExp(opacityValue, minOpacityValue, maxOpacityValue, 0.1, 0.8, opacityCensusOrder);
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
          weight = scaleExp(outlineValue, minOutlineValue, maxOutlineValue, 0, 4, outlineCensusOrder);
        }
      }

      return {
        fillColor: baseColor,
        weight: weight,
        opacity: 1,
        color: 'black',
        fillOpacity: opacity
      };
    }
  }).addTo(map);

  updateLegend();
  updateFilterValues();
  updateSummaryStatistics(hexes.features);
  highlightSelectedArea();
}

function updateFilterValues() {
  console.log('updateFilterValues');
  const currentFilterType = filterTypeDropdown.value;
  const currentFilterValue = filterValueDropdown.value;

  let options = [];

  if (currentFilterType === 'Range') {
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
        '0-5', '5-10', '10-15', '15-20', '20-25', '25-30', '>30'
      ];
    }
  } else if (currentFilterType === 'Ward') {
    options = wardBoundariesLayer ? wardBoundariesLayer.getLayers().map(layer => layer.feature.properties.WD24NM) : [];
    options.sort();
  } else if (currentFilterType === 'GrowthZone') {
    options = GrowthZonesLayer ? GrowthZonesLayer.getLayers().map(layer => layer.feature.properties.Name) : [];
    options.sort();
  } else if (currentFilterType === 'LA') {
    options = ['MCA', 'LEP'];
    const uaOptions = uaBoundariesLayer ? uaBoundariesLayer.getLayers().map(layer => layer.feature.properties.LAD24NM) : [];
    uaOptions.sort();
    options = options.concat(uaOptions);
  }

  filterValueDropdown.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join('');

  if (options.includes(currentFilterValue)) {
    filterValueDropdown.value = currentFilterValue;
  }
}

function updateSummaryStatistics(features) {
  console.log('updateSummaryStatistics');
  
  const filteredFeatures = applyFilters(features);
  
  const stats = calculateStatistics(filteredFeatures);
  
  updateStatisticsUI(stats);
}

function applyFilters(features) {
  const filterType = filterTypeDropdown.value;
  const filterValue = filterValueDropdown.value;
  
  let filteredFeatures = features.length ? features : hexes.features;
  
  if (filterType === 'Range') {
    filteredFeatures = applyRangeFilter(filteredFeatures, filterValue);
  } 
  else if (['Ward', 'GrowthZone', 'LA'].includes(filterType)) {
    filteredFeatures = applyGeographicFilter(filteredFeatures, filterType, filterValue);
  }
  
  return filteredFeatures;
}

function applyRangeFilter(features, filterValue) {
  if (ScoresLayer) {
    const selectedYear = ScoresYear.value;
    const fieldToDisplay = selectedYear.includes('-') ? 
      `${ScoresPurpose.value}_${ScoresMode.value}` : 
      `${ScoresPurpose.value}_${ScoresMode.value}_100`;
    
    if (selectedYear.includes('-')) {
      return filterByScoreDifference(features, fieldToDisplay, filterValue);
    } else {
      return filterByPercentileRange(features, fieldToDisplay, filterValue);
    }
  } 
  else if (AmenitiesCatchmentLayer) {
    return filterByJourneyTime(features, filterValue);
  }
  
  return features;
}

function applyGeographicFilter(features, filterType, filterValue) {
  const getPolygonForFilter = () => {
    let polygon = null;
    
    if (filterType === 'Ward') {
      const wardLayer = wardBoundariesLayer.getLayers().find(layer => 
        layer.feature.properties.WD24NM === filterValue
      );
      polygon = wardLayer?.toGeoJSON();
    } 
    else if (filterType === 'GrowthZone') {
      const growthZoneLayer = GrowthZonesLayer.getLayers().find(layer => 
        layer.feature.properties.Name === filterValue
      );
      polygon = growthZoneLayer?.toGeoJSON();
    }
    else if (filterType === 'LA') {
      if (filterValue === 'MCA') {
        const mcaLayers = uaBoundariesLayer.getLayers().filter(layer => 
          layer.feature.properties.LAD24NM !== 'North Somerset'
        );
        polygon = mcaLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } 
      else if (filterValue === 'LEP') {
        const lepLayers = uaBoundariesLayer.getLayers();
        polygon = lepLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } 
      else {
        const uaLayer = uaBoundariesLayer.getLayers().find(layer => 
          layer.feature.properties.LAD24NM === filterValue
        );
        polygon = uaLayer?.toGeoJSON();
      }
    }
    
    return polygon;
  };
  
  const polygon = getPolygonForFilter();
  if (!polygon) return features;
  
  return features.filter(feature => {
    const hexPolygon = turf.polygon(feature.geometry.coordinates);
    return turf.booleanPointInPolygon(turf.center(hexPolygon), polygon);
  });
}

function calculateStatistics(features) {
  const baseStats = calculateBaseStatistics(features);
  
  let layerStats = {};
  
  if (ScoresLayer) {
    layerStats = calculateScoreStatistics(features);
  } else if (AmenitiesCatchmentLayer) {
    layerStats = calculateTimeStatistics(features);
  }
  
  return {...baseStats, ...layerStats};
}

function calculateBaseStatistics(features) {
  const metrics = {
    population: [],
    imd_score: [],
    imd_decile: [],
    carAvailability: [],
    growthpop: []
  };

  features.forEach(feature => {
    const props = feature.properties;
    metrics.population.push(props.pop || 0);
    metrics.imd_score.push(props.IMDScore || 0);
    metrics.imd_decile.push(props.IMD_Decile || 0);
    metrics.carAvailability.push(props.car_availability || 0);
    metrics.growthpop.push(props.pop_growth || 0);
  });

  return {
    totalPopulation: metrics.population.reduce((a, b) => a + b, 0),
    minPopulation: Math.min(...metrics.population.filter(val => val > 0), Infinity) || 0,
    maxPopulation: Math.max(...metrics.population, 0),
    avgImdScore: calculateWeightedAverage(metrics.imd_score, metrics.population),
    minImdScore: Math.min(...metrics.imd_score.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxImdScore: Math.max(...metrics.imd_score, 0),
    avgImdDecile: calculateWeightedAverage(metrics.imd_decile, metrics.population),
    minImdDecile: Math.min(...metrics.imd_decile.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxImdDecile: Math.max(...metrics.imd_decile, 0),
    avgCarAvailability: calculateWeightedAverage(metrics.carAvailability, metrics.population),
    minCarAvailability: Math.min(...metrics.carAvailability.filter((val, index) => val > 0 && metrics.population[index] > 0), Infinity) || 0,
    maxCarAvailability: Math.max(...metrics.carAvailability, 0),
    totalgrowthpop: metrics.growthpop.reduce((a, b) => a + b, 0),
    mingrowthpop: Math.min(...metrics.growthpop, 0),
    maxgrowthpop: Math.max(...metrics.growthpop, 0)
  };
}

function calculateScoreStatistics(features) {
  const selectedYear = ScoresYear.value;
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const scoreField = `${selectedPurpose}_${selectedMode}`;
  const percentileField = `${selectedPurpose}_${selectedMode}_100`;
  
  const metrics = {
    score: [],
    percentile: [],
    population: []
  };

  features.forEach(feature => {
    const props = feature.properties;
    metrics.score.push(props[scoreField] || 0);
    metrics.percentile.push(props[percentileField] || 0);
    metrics.population.push(props.pop || 0);
  });

  return {
    avgScore: calculateWeightedAverage(metrics.score, metrics.population),
    minScore: Math.min(...metrics.score),
    maxScore: Math.max(...metrics.score),
    avgPercentile: calculateWeightedAverage(metrics.percentile, metrics.population),
    minPercentile: Math.min(...metrics.percentile, 0),
    maxPercentile: Math.max(...metrics.percentile, 0),
    metricRow1: 'Score',
    metricRow2: 'Score Percentile',
    isScoreLayer: true,
    selectedYear
  };
}

function calculateTimeStatistics(features) {
  const metrics = {
    time: [],
    population: []
  };

  features.forEach(feature => {
    const props = feature.properties;
    const hexId = props.Hex_ID;
    const time = hexTimeMap[hexId] !== undefined ? hexTimeMap[hexId] : 0;
    metrics.time.push(time);
    metrics.population.push(props.pop || 0);
  });

  return {
    avgTime: calculateWeightedAverage(metrics.time, metrics.population),
    minTime: Math.min(...metrics.time.filter(val => val > 0), Infinity) || 0,
    maxTime: Math.max(...metrics.time, 0),
    metricRow1: '-',
    metricRow2: 'Journey Time',
    isTimeLayer: true
  };
}

function updateStatisticsUI(stats) {
  document.getElementById('total-population').textContent = formatValue(stats.totalPopulation, 1);
  document.getElementById('min-population').textContent = formatValue(stats.minPopulation, 1);
  document.getElementById('max-population').textContent = formatValue(stats.maxPopulation, 1);
  document.getElementById('avg-imd-score').textContent = formatValue(stats.avgImdScore, 0.1);
  document.getElementById('min-imd-score').textContent = formatValue(stats.minImdScore, 0.1);
  document.getElementById('max-imd-score').textContent = formatValue(stats.maxImdScore, 0.1);
  document.getElementById('avg-imd-decile').textContent = formatValue(stats.avgImdDecile, 1);
  document.getElementById('min-imd-decile').textContent = formatValue(stats.minImdDecile, 1);
  document.getElementById('max-imd-decile').textContent = formatValue(stats.maxImdDecile, 1);
  document.getElementById('avg-car-availability').textContent = formatValue(stats.avgCarAvailability, 0.01);
  document.getElementById('min-car-availability').textContent = formatValue(stats.minCarAvailability, 0.01);
  document.getElementById('max-car-availability').textContent = formatValue(stats.maxCarAvailability, 0.01);
  document.getElementById('total-growth-pop').textContent = formatValue(stats.totalgrowthpop, 1);
  document.getElementById('min-growth-pop').textContent = formatValue(stats.mingrowthpop, 1);
  document.getElementById('max-growth-pop').textContent = formatValue(stats.maxgrowthpop, 1);

  document.getElementById('metric-row-1').textContent = stats.metricRow1 || '-';
  document.getElementById('metric-row-2').textContent = stats.metricRow2 || '-';
  
  if (stats.isScoreLayer) {
    const formatScore = value => stats.selectedYear.includes('-') ? `${(value * 100).toFixed(1)}%` : formatValue(value, 1);
    document.getElementById('avg-score').textContent = formatScore(stats.avgScore);
    document.getElementById('min-score').textContent = formatScore(stats.minScore);
    document.getElementById('max-score').textContent = formatScore(stats.maxScore);
    document.getElementById('avg-percentile').textContent = formatValue(stats.avgPercentile, 1);
    document.getElementById('min-percentile').textContent = formatValue(stats.minPercentile, 1);
    document.getElementById('max-percentile').textContent = formatValue(stats.maxPercentile, 1);
  } 
  else if (stats.isTimeLayer) {
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('min-score').textContent = '-';
    document.getElementById('max-score').textContent = '-';
    document.getElementById('avg-percentile').textContent = formatValue(stats.avgTime, 1);
    document.getElementById('min-percentile').textContent = formatValue(stats.minTime, 1);
    document.getElementById('max-percentile').textContent = formatValue(stats.maxTime, 1);
  }
  else {
    document.getElementById('avg-score').textContent = '-';
    document.getElementById('min-score').textContent = '-';
    document.getElementById('max-score').textContent = '-';
    document.getElementById('avg-percentile').textContent = '-';
    document.getElementById('min-percentile').textContent = '-';
    document.getElementById('max-percentile').textContent = '-';
  }
}

function filterByScoreDifference(features, fieldToDisplay, filterValue) {
  if (filterValue === '= 0') {
    return features.filter(feature => {
      const value = feature.properties[fieldToDisplay];
      return Math.abs(value) < 0.0001;
    });
  }
  
  if (filterValue.includes('<=') || filterValue.includes('>=') || filterValue.includes('>') || filterValue.includes('<')) {
    let min = -Infinity;
    let max = Infinity;
    
    if (filterValue.includes('<=')) {
      max = parseFloat(filterValue.split('<=')[1].replace('%', '')) / 100;
    }
    if (filterValue.includes('>=')) {
      min = parseFloat(filterValue.split('>=')[1].replace('%', '')) / 100;
    }
    if (filterValue.includes('>') && !filterValue.includes('>=')) {
      const value = parseFloat(filterValue.split('>')[1].split('and')[0].replace('%', '')) / 100;
      min = Number.isNaN(value) ? -Infinity : value;
    }
    if (filterValue.includes('<') && !filterValue.includes('<=')) {
      const value = parseFloat(filterValue.split('<')[1].split('and')[0].replace('%', '')) / 100;
      max = Number.isNaN(value) ? Infinity : value;
    }
    
    if (filterValue.includes('and')) {
      if (filterValue.includes('>') && filterValue.includes('<=')) {
        min = parseFloat(filterValue.split('>')[1].split('and')[0].replace('%', '')) / 100;
        max = parseFloat(filterValue.split('<=')[1].replace('%', '')) / 100;
      } else if (filterValue.includes('>=') && filterValue.includes('<')) {
        min = parseFloat(filterValue.split('>=')[1].split('and')[0].replace('%', '')) / 100;
        max = parseFloat(filterValue.split('<')[1].replace('%', '')) / 100;
      }
    }
    
    return features.filter(feature => {
      const value = feature.properties[fieldToDisplay];
      const isAboveMin = min === -Infinity || value > min;
      const isBelowMax = max === Infinity || value <= max;
      return isAboveMin && isBelowMax;
    });
  }
  
  return features;
}

function filterByPercentileRange(features, fieldToDisplay, filterValue) {
  const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
  return features.filter(feature => {
    const value = feature.properties[fieldToDisplay];
    return value >= minRange && (maxRange ? value <= maxRange : true);
  });
}

function filterByJourneyTime(features, filterValue) {
  if (filterValue === '>30') {
    return features.filter(feature => {
      const hexId = feature.properties.Hex_ID;
      const time = hexTimeMap[hexId];
      return time > 30;
    });
  } else {
    const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
    return features.filter(feature => {
      const hexId = feature.properties.Hex_ID;
      const time = hexTimeMap[hexId];
      return time >= minRange && (maxRange ? time <= maxRange : true);
    });
  }
}

function calculateWeightedAverage(values, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  return weightedSum / totalWeight;
}

function getCurrentFeatures() {
  if (ScoresLayer) {
    return ScoresLayer.toGeoJSON().features;
  } else if (AmenitiesCatchmentLayer) {
    return AmenitiesCatchmentLayer.toGeoJSON().features;
  }
  return [];
}

function highlightSelectedArea() {
  const highlightAreaCheckbox = document.getElementById('highlightAreaCheckbox');
  if (!highlightAreaCheckbox.checked) {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    return;
  }
  const filterType = filterTypeDropdown.value;
  const filterValue = filterValueDropdown.value;

  let selectedPolygons = [];

  if (filterType === 'Ward') {
    const wardLayers = wardBoundariesLayer.getLayers().filter(layer => layer.feature.properties.WD24NM === filterValue);
    selectedPolygons = wardLayers.map(layer => layer.toGeoJSON());
  } else if (filterType === 'GrowthZone') {
    const growthZoneLayers = GrowthZonesLayer.getLayers().filter(layer => layer.feature.properties.Name === filterValue);
    selectedPolygons = growthZoneLayers.map(layer => layer.toGeoJSON());
  } else if (filterType === 'LA') {
    if (filterValue === 'MCA') {
      const mcaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM !== 'North Somerset');
      selectedPolygons = mcaLayers.map(layer => layer.toGeoJSON());
    } else if (filterValue === 'LEP') {
      const lepLayers = uaBoundariesLayer.getLayers();
      selectedPolygons = lepLayers.map(layer => layer.toGeoJSON());
    } else {
      const uaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM === filterValue);
      selectedPolygons = uaLayers.map(layer => layer.toGeoJSON());
    }
  }

  if (selectedPolygons.length > 0) {
    const unionPolygon = selectedPolygons.reduce((acc, polygon) => {
      return acc ? turf.union(acc, polygon) : polygon;
    }, null);

    const mapBounds = [-6.38, 49.87, 1.77, 55.81];
    const mapPolygon = turf.bboxPolygon(mapBounds);

    const inversePolygon = turf.difference(mapPolygon, unionPolygon);

    if (highlightLayer) {
      map.removeLayer(highlightLayer);
    }

    highlightLayer = L.geoJSON(inversePolygon, {
      style: {
        color: 'rgba(118,118,118,1)',
        weight: 1,
        fillColor: 'grey',
        fillOpacity: 0.75
      }
    }).addTo(map);
  }
}
