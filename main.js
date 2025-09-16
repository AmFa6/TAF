const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB, © Crown copyright and database rights 2025 OS 0100059651, Contains OS data © Crown copyright [and database right] 2025.',
  pane: 'tilePane' // Explicitly set to the default tile pane to ensure base layer is at the bottom
}).addTo(map);

// Add road labels only layer on top of the base layer
const LabelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png', {
  opacity: 0.6,
  pane: 'tooltipPane' // Use highest z-index pane to appear above everything
}).addTo(map);

let lsoaLookup = {};
const ladCodesString = ladCodes.map(code => `'${code}'`).join(',');

function convertMultiPolygonToPolygons(geoJson) {
  // console.log('Converting MultiPolygon to Polygon...');
  const features = [];
  const featureCounts = {};
  
  geoJson.features.forEach(feature => {
    const name = feature.properties.LAD24NM || feature.properties.WD24NM || feature.properties.LSOA21NM || feature.properties.name || feature.properties.Name || 'Unknown';
    featureCounts[name] = (featureCounts[name] || 0) + 1;
    
    if (feature.geometry.type === 'MultiPolygon') {      
      const parts = feature.geometry.coordinates.map((polygonCoords, index) => {
        const area = turf.area(turf.polygon(polygonCoords));
        return { index, area, coords: polygonCoords };
      });
      
      parts.sort((a, b) => b.area - a.area);
            
      if (name === 'North Somerset' || name === 'South Gloucestershire' || 
          (feature.properties.name && feature.properties.name.length > 0)) {
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
      pane: 'boundaryLayers',
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
      pane: 'boundaryLayers',
      style: function () {
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
      pane: 'boundaryLayers',
      style: function () {
        return {
          color: 'black',
          weight: 0.6,
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

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
const LayerTransparencySliderAmenities = document.getElementById('layerTransparencySliderAmenities');
const LayerTransparencySliderScores = document.getElementById('layerTransparencySliderScores');
const LayerTransparencyValueScores = document.getElementById('layerTransparencyValueScores');
const LayerTransparencyValueAmenities = document.getElementById('layerTransparencyValueAmenities');
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
    data.features = data.features.map(adjustSpecialHexCenters);
    hexes = data;
    if (initialLoadComplete) {
      updateSummaryStatistics(hexes.features);
    }
  })

fetch('https://AmFa6.github.io/TAF_test/GrowthZones.geojson')
  .then(response => response.json())
  .then(data => {
    GrowthZonesLayer = L.geoJSON(data, {
      pane: 'boundaryLayers',
      style: function () {
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

fetch('https://AmFa6.github.io/TAF_test/lines.geojson')
  .then(response => response.json())
  .then(data => {
    busLinesLayer = L.geoJSON(data, {
      pane: 'busLayers',
      style: function (feature) {
        const frequency = parseFloat(feature.properties.am_peak_service_frequency) || 0;
        const opacity = frequency === 0 ? 0.1 : Math.min(0.1 + (frequency / 6) * 0.4, 0.5);
        
        return {
          color: 'green',
          weight: 2,
          fillOpacity: 0,
          opacity: 0,
          _calculatedOpacity: opacity
        };
      },
    }).addTo(map);
  });

fetch('https://AmFa6.github.io/TAF_test/stops.geojson')
  .then(response => response.json())
  .then(data => {
    busStopsLayer = L.geoJSON(data, {
      pane: 'busLayers',
      pointToLayer: function(feature, latlng) {
        const frequency = parseFloat(feature.properties.am_peak_combined_frequency) || 0;
        const fillOpacity = frequency === 0 ? 0 : Math.min(frequency / 12, 1);
        
        return L.circleMarker(latlng, {
          radius: 3,
          fillColor: 'green',
          color: 'green',
          weight: 0.5,
          opacity: 0,
          fillOpacity: 0,
          _calculatedFillOpacity: fillOpacity
        });
      }
    }).addTo(map);
  });

fetch('https://AmFa6.github.io/TAF_test/westlink.geojson')
  .then(response => response.json())
  .then(data => {
    const colors = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', 
      '#ffff33', '#a65628', '#f781bf', '#999999', '#66c2a5',
      '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f'
    ];
    const convertedData = convertMultiPolygonToPolygons(data);
    WestLinkZonesLayer = L.geoJSON(convertedData, {
      pane: 'boundaryLayers',
      style: function (feature, layer) {
        const featureIndex = convertedData.features.findIndex(f => 
          f.properties.Name === feature.properties.Name
        );
        const colorIndex = featureIndex % colors.length;
        return {
          color: colors[colorIndex],
          weight: 3,
          fillColor: 'black',
          fillOpacity: 0,
          opacity: 0
        };
      },
    }).addTo(map);
  })

fetch('https://AmFa6.github.io/TAF_test/simplified_network.geojson')
  .then(response => response.json())
  .then(data => {
    roadNetworkLayer = L.geoJSON(data, {
      pane: 'roadLayers',
      style: function (feature) {
        const roadFunction = feature.properties.roadfunction;
        let weight = 0.5;
        
        if (roadFunction === 'Motorway') {
          weight = 2;
        } else if (roadFunction === 'A Road') {
          weight = 1;
        }
        
        return {
          color: 'white',
          weight: weight,
          opacity: 0,
        };
      },
    }).addTo(map);
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
let layerTransparencyValue = 0.5; // Default to 50% opacity
let layerTransparencyUpdateTimeout; // For throttling transparency updates

// Throttled function to update layer transparency
function throttledUpdateLayerTransparency() {
  clearTimeout(layerTransparencyUpdateTimeout);
  layerTransparencyUpdateTimeout = setTimeout(updateLayerTransparency, 50); // 50ms throttle
}
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
let hexLayer = null;
let busLinesLayer;
let busStopsLayer;
let roadNetworkLayer;
let WestLinkZonesLayer;
let userLayers = [];
let userLayerCount = 0;
let drawControl;
let currentDrawingLayer = null;
let isDrawingActive = false;
let currentDrawType = null;
drawFeatureGroup = L.featureGroup({
  pane: 'userLayers'
}).addTo(map);
let isUpdatingStyles = false;
let isCalculatingStats = false;
let isUpdatingVisibility = false;
let isUpdatingFilters = false;
let isUpdatingFilterValues = false;
let currentEditingUserLayer = null;
let activeShapeMode = null; 
let activeActionMode = null;
let originalLayerState = null;
let hasUnsavedChanges = false;
let currentFeatureAttributes = {};
let pendingFeature = null;
let currentUserLayerId = null;
let defaultAttributes = { "Name": "" };
let previousFilterSelections = {
  LA: null,
  Ward: null,
  GrowthZone: null,
  WestLinkZone: null,
  Range: null,
};

initializeSliders(ScoresOpacityRange);
initializeSliders(ScoresOutlineRange);
initializeSliders(AmenitiesOpacityRange);
initializeSliders(AmenitiesOutlineRange);
initializeSliders(CensusOpacityRange);
initializeSliders(CensusOutlineRange);

// Try to initialize layer transparency slider, and retry if needed
setTimeout(() => {
  if (!initializeLayerTransparencySliderAmenities()) {
    setTimeout(initializeLayerTransparencySliderAmenities, 1000);
  }
}, 100);

// Try to initialize scores layer transparency slider, and retry if needed
setTimeout(() => {
  if (!initializeLayerTransparencySliderScores()) {
    setTimeout(initializeLayerTransparencySliderScores, 1000);
  }
}, 100);

ScoresYear.addEventListener("change", () => updateScoresLayer());
ScoresPurpose.addEventListener("change", () => updateScoresLayer());
ScoresMode.addEventListener("change", () => updateScoresLayer());
AmenitiesYear.addEventListener("change", () => {
  updateAmenitiesCatchmentLayer();
});

AmenitiesMode.addEventListener("change", () => {
  updateAmenitiesCatchmentLayer();
});
AmenitiesPurpose.forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    if (!checkbox.checked && selectingFromMap) {
      const selectedAmenityType = checkbox.value;
      if (selectedAmenitiesAmenities.includes(selectedAmenityType) && 
          selectedAmenitiesAmenities.length === 1) {
        selectingFromMap = false;
        selectedAmenitiesFromMap = [];
        const amenitiesDropdown = document.getElementById('amenitiesDropdown');
        if (amenitiesDropdown) {
          const amenitiesCheckboxes = document.getElementById('amenitiesCheckboxesContainer')
            .querySelectorAll('input[type="checkbox"]');
          const selectedCheckboxes = Array.from(amenitiesCheckboxes).filter(cb => cb.checked);
          if (selectedCheckboxes.length === 0) {
            amenitiesDropdown.textContent = '\u00A0';
          } else if (selectedCheckboxes.length === 1) {
            amenitiesDropdown.textContent = selectedCheckboxes[0].nextElementSibling.textContent;
          } else {
            amenitiesDropdown.textContent = 'Multiple Selection';
          }
        }
      }
    }
    updateAmenitiesCatchmentLayer();
  });
});

ScoresOpacity.addEventListener("change", () => {
  updateSliderRanges('Scores', 'Opacity');
  if (ScoresLayer) applyScoresLayerStyling();
});
ScoresOutline.addEventListener("change", () => {
  updateSliderRanges('Scores', 'Outline');
  if (ScoresLayer) applyScoresLayerStyling();
});
AmenitiesOpacity.addEventListener("change", () => {
  updateSliderRanges('Amenities', 'Opacity');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
AmenitiesOutline.addEventListener("change", () => {
  updateSliderRanges('Amenities', 'Outline');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
baseColorCensus.addEventListener("change", () => {
  if (CensusLayer) applyCensusLayerStyling();
  else updateCensusLayer();
});
CensusOpacity.addEventListener("change", () => {
  updateSliderRanges('Census', 'Opacity');
  if (CensusLayer) applyCensusLayerStyling();
});
CensusOutline.addEventListener("change", () => {
  updateSliderRanges('Census', 'Outline');
  if (CensusLayer) applyCensusLayerStyling();
});
ScoresInverseOpacity.addEventListener("click", () => {
  toggleInverseScale('Scores', 'Opacity');
  if (ScoresLayer) applyScoresLayerStyling();
});
ScoresInverseOutline.addEventListener("click", () => {
  toggleInverseScale('Scores', 'Outline');
  if (ScoresLayer) applyScoresLayerStyling();
});
AmenitiesInverseOpacity.addEventListener("click", () => {
  toggleInverseScale('Amenities', 'Opacity');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
AmenitiesInverseOutline.addEventListener("click", () => {
  toggleInverseScale('Amenities', 'Outline');
  if (AmenitiesCatchmentLayer) applyAmenitiesCatchmentLayerStyling();
});
CensusInverseOpacity.addEventListener("click", () => {
  toggleInverseScale('Census', 'Opacity');
  if (CensusLayer) applyCensusLayerStyling();
});
CensusInverseOutline.addEventListener("click", () => {
  toggleInverseScale('Census', 'Outline');
  if (CensusLayer) applyCensusLayerStyling();
});

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
    if (content) {
      content.style.display = "none";
      button.classList.add("collapsed");

      button.addEventListener("click", function() {
        this.classList.toggle("active");
        content.style.display = content.style.display === "block" ? "none" : "block";
        this.classList.toggle("collapsed", content.style.display === "none");
      });
    }
  });

  let lastAmenitiesState = {
    selectingFromMap: false,
    selectedAmenitiesFromMap: [],
    selectedAmenitiesAmenities: []
  };

  function handlePanelStateChange(header, isOpen) {
    const dataPanelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
    
    if (isOpen) {
      dataPanelHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          otherHeader.classList.add("collapsed");
          const otherContent = otherHeader.nextElementSibling;
          if (otherContent) {
            otherContent.style.display = "none";
          }
          
          if (otherHeader.textContent.includes("Journey Time Catchments - Amenities") && AmenitiesCatchmentLayer) {
            lastAmenitiesState = {
              selectingFromMap,
              selectedAmenitiesFromMap,
              selectedAmenitiesAmenities
            };
            map.removeLayer(AmenitiesCatchmentLayer);
            AmenitiesCatchmentLayer = null;
          } 
          else if (otherHeader.textContent.includes("Connectivity Scores") && ScoresLayer) {
            map.removeLayer(ScoresLayer);
            ScoresLayer = null;
          } else if (otherHeader.textContent.includes("Census / Local Plan Data") && CensusLayer) {
            map.removeLayer(CensusLayer);
            CensusLayer = null;
          }
        }
      });
    }
    
    requestAnimationFrame(() => {
      if (isOpen) {
        if (header.textContent.includes("Connectivity Scores")) {
          updateScoresLayer();
        } else if (header.textContent.includes("Journey Time Catchments - Amenities")) {
          if (lastAmenitiesState.selectingFromMap) {
            selectingFromMap = lastAmenitiesState.selectingFromMap;
            selectedAmenitiesFromMap = [...lastAmenitiesState.selectedAmenitiesFromMap];
            
            AmenitiesPurpose.forEach(checkbox => {
              checkbox.checked = lastAmenitiesState.selectedAmenitiesAmenities.includes(checkbox.value);
            });
            
            const amenitiesDropdown = document.getElementById('amenitiesDropdown');
            if (amenitiesDropdown && selectedAmenitiesFromMap.length > 0) {
              const amenityType = lastAmenitiesState.selectedAmenitiesAmenities[0];
              const typeLabel = getAmenityTypeDisplayName(amenityType);
              amenitiesDropdown.textContent = `${typeLabel} (ID: ${selectedAmenitiesFromMap.join(',')})`;
            }
          }
          updateAmenitiesCatchmentLayer();
        } else if (header.textContent.includes("Census / Local Plan Data")) {
          updateCensusLayer();
        }
        
        requestAnimationFrame(() => {
          updateFilterDropdown();
          updateFilterValues();
        });
      } else {
        if (header.textContent.includes("Connectivity Scores") && ScoresLayer) {
          map.removeLayer(ScoresLayer);
          ScoresLayer = null;
          drawSelectedAmenities([]); 
        } else if (header.textContent.includes("Journey Time Catchments - Amenities") && AmenitiesCatchmentLayer) {
          lastAmenitiesState = {
            selectingFromMap,
            selectedAmenitiesFromMap,
            selectedAmenitiesAmenities
          };
          map.removeLayer(AmenitiesCatchmentLayer);
          AmenitiesCatchmentLayer = null;
          drawSelectedAmenities([]);
        } else if (header.textContent.includes("Census / Local Plan Data") && CensusLayer) {
          map.removeLayer(CensusLayer);
          CensusLayer = null;
        }
        
        requestAnimationFrame(() => {
          updateFilterDropdown();
          updateFilterValues();
        });
      }
    });
  }

  const panelHeaders = document.querySelectorAll(".panel-header");
  panelHeaders.forEach(header => {
    const content = header.nextElementSibling;
    if (content) {
      content.style.display = "none";
      header.classList.add("collapsed");

      header.addEventListener("click", function() {
        const isCurrentlyOpen = !this.classList.contains('collapsed');
        const willOpen = !isCurrentlyOpen;
        
        this.classList.toggle("collapsed");
        content.style.display = willOpen ? "block" : "none";
        
        if (!this.classList.contains('summary-header')) {
          handlePanelStateChange(this, willOpen);
        }
      });
    }
  });

  const summaryHeader = document.getElementById('toggle-summary-panel');
  const summaryContent = document.getElementById('summary-content');
  
  if (summaryHeader && summaryContent) {
    summaryContent.style.display = "none";
    summaryHeader.classList.add("collapsed");
    
    summaryHeader.addEventListener("click", function() {
      const isCollapsed = this.classList.contains("collapsed");
      this.classList.toggle("collapsed");
      summaryContent.style.display = isCollapsed ? "block" : "none";
    });
    
    summaryHeader.addEventListener("click", function() {
      this.classList.toggle("collapsed");
      const isNowCollapsed = this.classList.contains("collapsed");
      summaryContent.style.display = isNowCollapsed ? "none" : "block";
    });
  }

  const amenitiesDropdown = document.getElementById('amenitiesDropdown');
  const amenitiesCheckboxesContainer = document.getElementById('amenitiesCheckboxesContainer');
  const amenitiesCheckboxes = amenitiesCheckboxesContainer.querySelectorAll('input[type="checkbox"]');

  amenitiesDropdown.addEventListener('click', () => {
    amenitiesCheckboxesContainer.classList.toggle('show');
  });

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
    const amenitiesCheckbox = document.getElementById('amenitiesCheckbox');
    if (amenitiesCheckbox) {
      amenitiesCheckbox.addEventListener('change', () => {
        if (amenitiesCheckbox.checked) {
          amenitiesLayerGroup.addTo(map);
        } else {
          map.removeLayer(amenitiesLayerGroup);
        }
      });
    }

    const uaBoundariesCheckbox = document.getElementById('uaBoundariesCheckbox');
    if (uaBoundariesCheckbox) {
      uaBoundariesCheckbox.addEventListener('change', () => {
        if (uaBoundariesCheckbox.checked) {
          uaBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          uaBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }

    const wardBoundariesCheckbox = document.getElementById('wardBoundariesCheckbox');
    if (wardBoundariesCheckbox) {
      wardBoundariesCheckbox.addEventListener('change', () => {
        if (wardBoundariesCheckbox.checked) {
          wardBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          wardBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const lsoaCheckbox = document.getElementById('lsoaCheckbox');
    if (lsoaCheckbox) {
      lsoaCheckbox.addEventListener('change', () => {
        if (lsoaCheckbox.checked) {
          lsoaBoundariesLayer.setStyle({ opacity: 1 });
        } else {
          lsoaBoundariesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const GrowthZonesCheckbox = document.getElementById('GrowthZonesCheckbox');
    if (GrowthZonesCheckbox) {
      GrowthZonesCheckbox.addEventListener('change', () => {
        if (GrowthZonesCheckbox.checked) {
          GrowthZonesLayer.setStyle({ opacity: 1 });
        } else {
          GrowthZonesLayer.setStyle({ opacity: 0 });
        }
      });
    }
    
    const busStopsCheckbox = document.getElementById('busStopsCheckbox');
    if (busStopsCheckbox) {
      busStopsCheckbox.addEventListener('change', () => {
        if (busStopsCheckbox.checked) {
          busStopsLayer.eachLayer(layer => {
            layer.setStyle({ 
              opacity: 1, 
              fillOpacity: layer.options._calculatedFillOpacity 
            });
          });
        } else {
          busStopsLayer.eachLayer(layer => {
            layer.setStyle({ opacity: 0, fillOpacity: 0 });
          });
        }
      });
    }
    
    const busLinesCheckbox = document.getElementById('busLinesCheckbox');
    if (busLinesCheckbox) {
      busLinesCheckbox.addEventListener('change', () => {
        if (busLinesCheckbox.checked) {
          busLinesLayer.eachLayer(layer => {
            layer.setStyle({ opacity: layer.options._calculatedOpacity });
          });
        } else {
          busLinesLayer.setStyle({ opacity: 0 });
        }
      });
    }

    const WestLinkZonesCheckbox = document.getElementById('WestLinkZonesCheckbox');
    if (WestLinkZonesCheckbox) {
      WestLinkZonesCheckbox.addEventListener('change', () => {
        if (WestLinkZonesCheckbox.checked) {
          WestLinkZonesLayer.setStyle({
            opacity: 1,
          });
        } else {
          WestLinkZonesLayer.setStyle({
            opacity: 0,
          });
        }
      });
    }
    const roadNetworkCheckbox = document.getElementById('roadNetworkCheckbox');
      if (roadNetworkCheckbox) {
        roadNetworkCheckbox.addEventListener('change', () => {
          if (roadNetworkCheckbox.checked) {
            roadNetworkLayer.setStyle({
                opacity: 1,
              });
          } else {
            roadNetworkLayer.setStyle({
              opacity: 0,
            });
          }
        });
      }
  }
  createStaticLegendControls();

  function initializeLegendControls() {
    document.querySelectorAll('.legend-category-header').forEach(header => {
      header.addEventListener('click', function() {
        const category = this.closest('.legend-category');
        category.classList.toggle('legend-category-collapsed');
      });
    });
    
    const legendHeader = document.querySelector('.legend-header');
    let isLegendExpanded = true;
    
    legendHeader.addEventListener('click', function() {
      isLegendExpanded = !isLegendExpanded;
      
      const legend = document.getElementById('legend');
      legend.classList.toggle('collapsed', !isLegendExpanded);
      
      const legendContent = document.getElementById('legend-content-wrapper');
      if (legendContent) {
        legendContent.style.display = isLegendExpanded ? 'block' : 'none';
      }
    });
  }
  
  initializeLegendControls();

  const dataLayerCategory = document.getElementById('data-layer-category');
  if (dataLayerCategory) {
    dataLayerCategory.style.display = 'none';
  }

  updateFilterDropdown();
  updateFilterValues();

  initialLoadComplete = true;
  const fileInput = document.getElementById('fileUpload');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const uploadButton = document.getElementById('uploadButton');
  
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      fileNameDisplay.textContent = this.files[0].name;
      uploadButton.disabled = false;
    } else {
      fileNameDisplay.textContent = '';
      uploadButton.disabled = true;
    }
  });
  
  uploadButton.addEventListener('click', function() {
    const file = fileInput.files[0];
    if (!file) return;
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'geojson' || fileExtension === 'json') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const layerData = JSON.parse(e.target.result);
          addUserLayer(layerData, file.name);
        } catch (error) {
          alert('Error processing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    } else if (fileExtension === 'kml') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const kml = new DOMParser().parseFromString(e.target.result, 'text/xml');
          const layerData = toGeoJSON.kml(kml);
          addUserLayer(layerData, file.name);
        } catch (error) {
          alert('Error processing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
    
    fileInput.value = '';
    fileNameDisplay.textContent = '';
    uploadButton.disabled = true;
  });

  initializeFileUpload();

  document.getElementById('add-attribute-field').addEventListener('click', function() {
    addAttributeField();
  });
  
  document.getElementById('save-attributes').addEventListener('click', function() {
    saveAttributes();
  });
  
  document.getElementById('cancel-attributes').addEventListener('click', function() {
    cancelAttributeEditing();
  });
  
  addContextMenuStyles();
  setupDrawingTools();

  function setupMapPanes() {
    const existingPanes = document.querySelectorAll('.leaflet-pane[style*="z-index"]');
    existingPanes.forEach(pane => {
      if (pane.className.includes('custom-pane')) {
        pane.parentNode.removeChild(pane);
      }
    });
    
    // Ensure base layer pane is at the bottom
    map.getPane('tilePane').style.zIndex = 200;
    
    map.createPane('polygonLayers').style.zIndex = 300;
    map.createPane('boundaryLayers').style.zIndex = 400;
    map.createPane('roadLayers').style.zIndex = 500;
    map.createPane('busLayers').style.zIndex = 600;
    map.createPane('userLayers').style.zIndex = 700;
  }
  
  setupMapPanes();
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
  if (isDrawingActive) {
    return;
  }

  const clickedLatLng = e.latlng;
  const clickedPoint = turf.point([clickedLatLng.lng, clickedLatLng.lat]);

    let userLayerFeatureFound = false;
  
  if (userLayers && userLayers.length > 0) {
    for (const userLayer of userLayers) {
      if (!userLayer.layer || !map.hasLayer(userLayer.layer)) continue;
      
      const nearbyFeatures = findNearbyInfrastructure(clickedLatLng, 10, userLayer.layer);
      
      if (nearbyFeatures && nearbyFeatures.features && nearbyFeatures.features.length > 0) {
        const nearestFeature = nearbyFeatures.features[0];
        
        let properties = nearestFeature.feature.feature.properties || {};
        
        let popupContent = `<div class="custom-feature-popup">`;
        popupContent += `<h4>${userLayer.name || 'Custom Feature'}</h4>`;
        
        if (Object.keys(properties).length > 0) {
          popupContent += `<table class="popup-table">`;
          popupContent += `<tr><th>Property</th><th>Value</th></tr>`;
          for (const [key, value] of Object.entries(properties)) {
            if (key !== 'id' && key !== 'layerId') {
              popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
          }
          popupContent += `</table>`;
        }
        
        popupContent += `</div>`;
        
        L.popup()
          .setLatLng(clickedLatLng)
          .setContent(popupContent)
          .openOn(map);
        
        userLayerFeatureFound = true;
        break;
      }
    }
    
    if (userLayerFeatureFound) return;
  }

  const busStopsVisible = document.getElementById('busStopsCheckbox')?.checked;
  const busLinesVisible = document.getElementById('busLinesCheckbox')?.checked;
  
  if (busStopsVisible || busLinesVisible) {
    const nearbyFeatures = findNearbyInfrastructure(clickedLatLng);
    
    if (!busStopsVisible) nearbyFeatures.busStops = [];
    if (!busLinesVisible) nearbyFeatures.busLines = [];
    
    const hasNearbyFeatures = 
      nearbyFeatures.busStops.length > 0 || 
      nearbyFeatures.busLines.length > 0;
    
    if (hasNearbyFeatures) {
      showInfrastructurePopup(clickedLatLng, nearbyFeatures);
      return;
    }
  }
  
  const popupContent = {
    Geographies: [],
    Hexagon: []
  };

  let isWithinLEP = false;
  if (uaBoundariesLayer) {
    uaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        isWithinLEP = true;
        popupContent.Geographies.push(`<strong>Local Authority:</strong> ${layer.feature.properties.LAD24NM}`);
      }
    });
  }

  if (!isWithinLEP) {
    return;
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

  if (WestLinkZonesLayer) {
    WestLinkZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Geographies.push(`<strong>WESTlink Zone:</strong> ${layer.feature.properties.Name}`);
      }
    });
  }

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
          const population = formatValue(properties.pop, 10);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.IMD_Decile, 1);
          const carAvailability = formatValue(properties.car_availability, 0.01);
          const growthPop = formatValue(properties.pop_growth, 10);
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
          const population = formatValue(properties.pop, 10);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.IMD_Decile, 1);
          const carAvailability = formatValue(properties.car_availability, 0.01);
          const growthPop = formatValue(properties.pop_growth, 10);

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
        const population = formatValue(properties.pop, 10);
        const imdScore = formatValue(properties.IMDScore, 0.1);
        const imdDecile = formatValue(properties.IMD_Decile, 1);
        const carAvailability = formatValue(properties.car_availability, 0.01);
        const growthPop = formatValue(properties.pop_growth, 10);

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
      <h4 style="text-decoration: underline;">Geographies</h4>
      ${popupContent.Geographies.length > 0 ? popupContent.Geographies.join('<br>') : '-'}
      <h4 style="text-decoration: underline;">Hexagon</h4>
      ${popupContent.Hexagon.length > 0 ? popupContent.Hexagon.join('<br>') : '-'}
    </div>
  `;

  L.popup()
    .setLatLng(clickedLatLng)
    .setContent(content)
    .openOn(map);
});

function initializeFileUpload() {
  // console.log('Initializing file upload...');
  const fileInput = document.getElementById('fileUpload');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const uploadButton = document.getElementById('uploadButton');
  
  if (!fileInput || !uploadButton) return;
  
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      fileNameDisplay.textContent = this.files[0].name;
      uploadButton.disabled = false;
    } else {
      fileNameDisplay.textContent = '';
      uploadButton.disabled = true;
    }
  });
  
  uploadButton.addEventListener('click', function() {
    const file = fileInput.files[0];
    if (!file) return;
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'geojson' || fileExtension === 'json') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const layerData = JSON.parse(e.target.result);
          addUserLayer(layerData, file.name);
        } catch (error) {
          alert('Error processing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    } else if (fileExtension === 'kml') {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const kml = new DOMParser().parseFromString(e.target.result, 'text/xml');
          const layerData = toGeoJSON.kml(kml);
          addUserLayer(layerData, file.name);
        } catch (error) {
          alert('Error processing file: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
    
    fileInput.value = '';
    fileNameDisplay.textContent = '';
    uploadButton.disabled = true;
  });
}

function createFeaturePopupContent(properties, layerName) {
  let popupContent = `<div class="custom-feature-popup">`;
  popupContent += `<h4>${layerName || 'Custom Feature'}</h4>`;
  
  if (properties && Object.keys(properties).length > 0) {
    popupContent += `<table class="popup-table">`;
    popupContent += `<tr><th>Property</th><th>Value</th></tr>`;
    for (const [key, value] of Object.entries(properties)) {
      if (key !== 'id' && key !== 'layerId') {
        popupContent += `<tr><td>${key}</td><td>${value || ''}</td></tr>`;
      }
    }
    popupContent += `</table>`;
  }
  
  popupContent += `</div>`;
  return popupContent;
}

function addUserLayer(data, fileName) {
  try {
    const layerId = `userLayer_${userLayerCount++}`;
    const layerName = fileName.split('.')[0];
    
    let reprojectedData = detectAndFixProjection(data);
    
    const fieldNames = [];
    const numericFields = [];
    
    if (reprojectedData.features && reprojectedData.features.length > 0) {
      const properties = reprojectedData.features[0].properties;
      for (const key in properties) {
        fieldNames.push(key);
        if (!isNaN(parseFloat(properties[key])) && isFinite(properties[key])) {
          numericFields.push(key);
        }
      }
    }
    
    const defaultColor = '#000000';

    const layer = L.geoJSON(reprojectedData, {
      pane: 'userLayers',
      style: function() {
        return {
          color: defaultColor,
          weight: 3,
          opacity: 0.75,
          fillColor: defaultColor,
          fillOpacity: 0.3
        };
      },
      onEachFeature: function(feature, layer) {
        if (feature.properties) {
          layer.on('click', function(e) {
            if (isDrawingActive && activeShapeMode) {
            } else {
              const popupContent = createFeaturePopupContent(feature.properties, layerName);
              L.popup()
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(map);
            }
          });
        }
      },
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 3,
          fillColor: defaultColor,
          color: defaultColor,
          weight: 1,
          opacity: 0.75,
          fillOpacity: 0.75
        });
      }
    }).addTo(map);
    
    const userLayer = {
      id: layerId,
      name: layerName,
      fileName: fileName,
      layer: layer,
      defaultColor: defaultColor,
      strokeOpacity: 0.75,
      weight: 3,
      fillColor: defaultColor,
      fillOpacity: 0.3,
      fieldNames: fieldNames,
      numericFields: numericFields,
      originalData: reprojectedData,
      labelField: '',
      labelColor: '#000000',
      labelOpacity: 1,
      labelSize: 12
    };
    userLayers.push(userLayer);
    
    const userLayersContainer = document.getElementById('userLayersContainer');
    if (userLayersContainer) {
      const template = document.getElementById('user-layer-template');
      const layerControl = document.importNode(template.content, true).querySelector('.user-layer-item');
      
      const checkbox = layerControl.querySelector('input[type="checkbox"]');
      checkbox.id = `${layerId}_check`;
      
      const layerNameSpan = layerControl.querySelector('span');
      layerNameSpan.textContent = layerName.length > 15 ? layerName.substring(0, 15) + '...' : layerName;
      layerNameSpan.title = layerName;
      
      layerControl.querySelectorAll('button').forEach(button => {
        button.setAttribute('data-id', layerId);
      });
      
      userLayersContainer.appendChild(layerControl);
      
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          map.addLayer(userLayer.layer);
          if (userLayer.labelLayerGroup) {
            map.addLayer(userLayer.labelLayerGroup);
          }
        } else {
          map.removeLayer(userLayer.layer);
          if (userLayer.labelLayerGroup) {
            map.removeLayer(userLayer.labelLayerGroup);
          }
        }
      });
      
      layerControl.querySelector('.layer-style-btn').addEventListener('click', function() {
        const layerId = this.getAttribute('data-id');
        openStyleDialog(layerId);
      });
      
      layerControl.querySelector('.layer-edit-btn').addEventListener('click', function() {
        const layerId = this.getAttribute('data-id');
        startEditingLayer(layerId);
      });
      
      layerControl.querySelector('.layer-zoom-btn').addEventListener('click', function() {
        try {
          const layerId = this.getAttribute('data-id');
          const userLayer = userLayers.find(l => l.id === layerId);
          if (userLayer && userLayer.layer) {
            map.fitBounds(userLayer.layer.getBounds());
          }
        } catch (e) {
          console.error("Error zooming to layer bounds:", e);
        }
      });
      
      layerControl.querySelector('.layer-remove-btn').addEventListener('click', function() {
        const layerId = this.getAttribute('data-id');
        removeUserLayer(layerId);
        updateFilterDropdown();
        updateFilterValues();
      });
      
      try {
        map.fitBounds(layer.getBounds());
      } catch (e) {
        console.error("Error zooming to layer bounds:", e);
      }
      
      updateFilterDropdown();
    }
    
    drawFeatureGroup.clearLayers();
    
    return layer;
  } catch (error) {
    alert('Error adding layer: ' + error.message);
    console.error("Error details:", error);
    return null;
  }
}

function applySimpleStyle(layerId, color) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  userLayer.defaultColor = color;
  applyUserLayerStyle(layerId);
}

function openStyleDialog(layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;

  const existingModal = document.getElementById('style-dialog');
  if (existingModal) {
    document.body.removeChild(existingModal);
  }

  const template = document.getElementById('style-dialog-template');
  const dialog = document.importNode(template.content, true).querySelector('#style-dialog');
  
  dialog.querySelector('#style-dialog-title').textContent = `Style: ${userLayer.name}`;
  
  let hasPolygons = false;
  
  if (userLayer.layer) {
    userLayer.layer.eachLayer(layer => {
      if (layer.feature && layer.feature.geometry) {
        const geomType = layer.feature.geometry.type;
        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          hasPolygons = true;
        }
      }
    });
  }
  
  const featureColor = dialog.querySelector('#feature-color');
  featureColor.value = userLayer.defaultColor || '#000000';
  
  const featureOpacity = dialog.querySelector('#feature-opacity');
  featureOpacity.value = userLayer.strokeOpacity ? userLayer.strokeOpacity * 100 : 75;
  dialog.querySelector('#feature-opacity-value').textContent = `${featureOpacity.value}%`;
  
  const featureSize = dialog.querySelector('#feature-size');
  featureSize.value = userLayer.weight || 3;
  dialog.querySelector('#feature-size-value').textContent = featureSize.value;
  
  const fillOptions = dialog.querySelector('.fill-options');
  if (fillOptions) {
    fillOptions.style.display = hasPolygons ? 'block' : 'none';
  }
  
  const featureFillColor = dialog.querySelector('#feature-fill-color');
  featureFillColor.value = userLayer.fillColor || userLayer.defaultColor || '#000000';
  
  const featureFillOpacity = dialog.querySelector('#feature-fill-opacity');
  featureFillOpacity.value = userLayer.fillOpacity ? userLayer.fillOpacity * 100 : 30;
  dialog.querySelector('#feature-fill-opacity-value').textContent = `${featureFillOpacity.value}%`;
  
  const labelField = dialog.querySelector('#label-field');
  if (userLayer.fieldNames) {
    userLayer.fieldNames.forEach(field => {
      const option = document.createElement('option');
      option.value = field;
      option.textContent = field;
      if (userLayer.labelField === field) {
        option.selected = true;
      }
      labelField.appendChild(option);
    });
  }
  
  const labelColor = dialog.querySelector('#label-color');
  labelColor.value = userLayer.labelColor || '#000000';
  
  const labelOpacity = dialog.querySelector('#label-opacity');
  labelOpacity.value = userLayer.labelOpacity ? userLayer.labelOpacity * 100 : 100;
  dialog.querySelector('#label-opacity-value').textContent = `${labelOpacity.value}%`;
  
  const labelSize = dialog.querySelector('#label-size');
  labelSize.value = userLayer.labelSize || 12;
  dialog.querySelector('#label-size-value').textContent = `${labelSize.value}px`;
  
  featureOpacity.addEventListener('input', function() {
    dialog.querySelector('#feature-opacity-value').textContent = `${this.value}%`;
  });
  
  featureSize.addEventListener('input', function() {
    dialog.querySelector('#feature-size-value').textContent = this.value;
  });
  
  featureFillOpacity.addEventListener('input', function() {
    dialog.querySelector('#feature-fill-opacity-value').textContent = `${this.value}%`;
  });
  
  labelOpacity.addEventListener('input', function() {
    dialog.querySelector('#label-opacity-value').textContent = `${this.value}%`;
  });
  
  labelSize.addEventListener('input', function() {
    dialog.querySelector('#label-size-value').textContent = `${this.value}px`;
  });
  
  dialog.querySelector('#apply-style').addEventListener('click', function() {
    userLayer.defaultColor = featureColor.value;
    userLayer.strokeOpacity = featureOpacity.value / 100;
    userLayer.weight = parseInt(featureSize.value);
    
    if (hasPolygons) {
      userLayer.fillColor = featureFillColor.value;
      userLayer.fillOpacity = featureFillOpacity.value / 100;
    }
    
    userLayer.labelField = labelField.value;
    userLayer.labelColor = labelColor.value;
    userLayer.labelOpacity = labelOpacity.value / 100;
    userLayer.labelSize = parseInt(labelSize.value);
    
    applyUserLayerStyle(layerId);
    document.body.removeChild(dialog);
  });
  
  dialog.querySelector('#cancel-style').addEventListener('click', function() {
    document.body.removeChild(dialog);
  });
  
  document.body.appendChild(dialog);
}

function applyUserLayerStyle(layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  if (userLayer.labelLayerGroup) {
    map.removeLayer(userLayer.labelLayerGroup);
    userLayer.labelLayerGroup = null;
  }
  
  userLayer.labelLayerGroup = L.layerGroup().addTo(map);
  
  userLayer.layer.eachLayer(layer => {
    if (layer.setStyle) {
      if (layer._customStyle) {
        layer.setStyle(layer._customStyle);
      } else {
        layer.setStyle({
          color: userLayer.defaultColor || '#000000',
          weight: userLayer.weight || 3,
          opacity: userLayer.strokeOpacity || 0.75,
          fillColor: userLayer.fillColor || userLayer.defaultColor || '#000000',
          fillOpacity: userLayer.fillOpacity || 0.3
        });
      }
    } else if (layer.setIcon) {
      const markerElement = layer.getElement();
      if (markerElement) {
      }
    }
    applyFeatureLabelStyle(layer, userLayer);
  });
  
  if (userLayer.labelField && userLayer.labelField !== '') {
    userLayer.labelLayerGroup = L.layerGroup().addTo(map);
    
    userLayer.layer.eachLayer(layer => {
      if (layer.feature && layer.feature.properties && 
          layer.feature.properties[userLayer.labelField] !== undefined) {
        
        const labelValue = layer.feature.properties[userLayer.labelField];
        
        let labelPosition;
        if (layer.getLatLng) {
          labelPosition = layer.getLatLng();
        } else if (layer.getCenter) {
          labelPosition = layer.getCenter();
        } else if (layer.feature.geometry) {
          const center = turf.center(layer.feature);
          labelPosition = L.latLng(
            center.geometry.coordinates[1], 
            center.geometry.coordinates[0]
          );
        }
        
        if (labelPosition) {
          const opacity = userLayer.labelOpacity !== undefined ? userLayer.labelOpacity : 1;
          const labelIcon = L.divIcon({
            className: 'user-layer-label',
            html: `<div style="color:${userLayer.labelColor}; opacity:${opacity}; font-size:${userLayer.labelSize}px; 
                   text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;">
                   ${labelValue}</div>`,
            iconSize: [100, 40],
            iconAnchor: [50, 20]
          });
          
          const labelMarker = L.marker(labelPosition, {
            icon: labelIcon,
            interactive: false,
            pane: 'userLayers'
          });
          
          userLayer.labelLayerGroup.addLayer(labelMarker);
        }
      }
    });
  }
}

function startEditingLayer(layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  resetAllModes();
  
  isDrawingActive = true;
  activeActionMode = 'edit';
  currentEditingUserLayer = userLayer;
  
  saveOriginalState();
  
  userLayer.editEnabled = true;
  userLayer.layer.eachLayer(layer => {
    if (layer.editing) {
      layer.editing.enable();
    }
    
    layer.on('click', function(e) {
      L.DomEvent.stopPropagation(e);
      currentDrawingLayer = this;
      
      showFeatureContextMenu(e.latlng, this, userLayer);
    });
  });
  
  const saveDrawingContainer = document.getElementById('save-drawing-container');
  if (saveDrawingContainer) {
    saveDrawingContainer.style.display = 'flex';
  }
  
  const drawingNameInput = document.getElementById('drawingNameInput');
  if (drawingNameInput) {
    drawingNameInput.value = userLayer.name || '';
    drawingNameInput.disabled = true;
    drawingNameInput.style.opacity = '0.6';
    drawingNameInput.style.backgroundColor = '#f0f0f0';
  }
  
  const instructions = document.getElementById('drawing-instructions');
  if (instructions) {
    instructions.textContent = 'Editing mode: Click on features to edit or delete them. Use drawing tools to add new features. Press ESC to cancel.';
    instructions.style.display = 'block';
  }
  
  map.getContainer().style.cursor = 'pointer';
}

function resetAllModes() {
  if (drawPointBtn) drawPointBtn.classList.remove('active');
  if (drawLineBtn) drawLineBtn.classList.remove('active');
  if (drawPolygonBtn) drawPolygonBtn.classList.remove('active');
  
  isDrawingActive = false;
  currentDrawType = null;
  activeShapeMode = null;
  activeActionMode = null;
  
  if (map.drawHandler) {
    map.off('click', map.drawHandler);
    map.drawHandler = null;
  }
  
  if (map.activeDrawingTool) {
    map.activeDrawingTool.disable();
    map.activeDrawingTool = null;
  }
  
  const instructions = document.getElementById('drawing-instructions');
  if (instructions) {
    instructions.style.display = 'none';
  }

  userLayers.forEach(userLayer => {
    if (userLayer.layer) {
      userLayer.layer.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          layer.editing.disable();
        }
        layer.off('click');
      });
      userLayer.editEnabled = false;
    }
  });
    
  drawFeatureGroup.eachLayer(layer => {
    if (layer.editing && layer.editing.enabled()) {
      layer.editing.disable();
    }
    layer.off('click');
  });
  
  const existingMenu = document.getElementById('feature-context-menu');
  if (existingMenu) {
    document.body.removeChild(existingMenu);
  }
  
  map.getContainer().style.cursor = '';
  
  const saveDrawingContainer = document.getElementById('save-drawing-container');
  if (saveDrawingContainer) {
    saveDrawingContainer.style.display = 'none';
  }
  
  const drawingNameInput = document.getElementById('drawingNameInput');
  if (drawingNameInput) {
    drawingNameInput.disabled = false;
    drawingNameInput.style.opacity = '1';
    drawingNameInput.style.backgroundColor = '#ffffff';
    drawingNameInput.value = '';
  }
  
  const saveDrawingBtn = document.getElementById('saveDrawingBtn');
  if (saveDrawingBtn) {
    saveDrawingBtn.disabled = false;
  }
  
  originalLayerState = null;
  hasUnsavedChanges = false;
  currentEditingUserLayer = null;
}

function saveOriginalState() {
  if (currentEditingUserLayer) {
    originalLayerState = {
      id: currentEditingUserLayer.id,
      name: currentEditingUserLayer.name,
      data: JSON.parse(JSON.stringify(currentEditingUserLayer.originalData))
    };
  } else {
    const drawnItemsGeoJSON = drawFeatureGroup.toGeoJSON();
    originalLayerState = {
      drawn: true,
      data: JSON.parse(JSON.stringify(drawnItemsGeoJSON))
    };
  }
  
  userLayers.forEach(userLayer => {
    if (userLayer.layer && map.hasLayer(userLayer.layer)) {
      userLayer._originalState = JSON.parse(JSON.stringify(userLayer.layer.toGeoJSON()));
    }
  });
  
  hasUnsavedChanges = false;
}

function showFeatureContextMenu(latlng, layer, userLayer) {
  const existingMenu = document.getElementById('feature-context-menu');
  if (existingMenu) {
    document.body.removeChild(existingMenu);
  }
  
  const contextMenu = document.createElement('div');
  contextMenu.id = 'feature-context-menu';
  contextMenu.className = 'feature-context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.zIndex = '1000';
  contextMenu.style.backgroundColor = 'white';
  contextMenu.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
  contextMenu.style.borderRadius = '4px';
  contextMenu.style.padding = '6px 0';
  
  const point = map.latLngToContainerPoint(latlng);
  contextMenu.style.left = `${point.x}px`;
  contextMenu.style.top = `${point.y}px`;
  
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit Attributes';
  editButton.style.display = 'block';
  editButton.style.width = '100%';
  editButton.style.padding = '6px 12px';
  editButton.style.backgroundColor = 'transparent';
  editButton.style.border = 'none';
  editButton.style.textAlign = 'left';
  editButton.style.cursor = 'pointer';
  
  const styleButton = document.createElement('button');
  styleButton.textContent = 'Style Feature';
  styleButton.style.display = 'block';
  styleButton.style.width = '100%';
  styleButton.style.padding = '6px 12px';
  styleButton.style.backgroundColor = 'transparent';
  styleButton.style.border = 'none';
  styleButton.style.textAlign = 'left';
  styleButton.style.cursor = 'pointer';
  
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete Feature';
  deleteButton.style.display = 'block';
  deleteButton.style.width = '100%';
  deleteButton.style.padding = '6px 12px';
  deleteButton.style.backgroundColor = 'transparent';
  deleteButton.style.border = 'none';
  deleteButton.style.textAlign = 'left';
  deleteButton.style.cursor = 'pointer';
  deleteButton.style.color = '#d32f2f';
  
  const addHoverEffect = (button) => {
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#f0f0f0';
    });
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = 'transparent';
    });
  };
  
  addHoverEffect(editButton);
  addHoverEffect(styleButton);
  addHoverEffect(deleteButton);
  
  editButton.addEventListener('click', () => {
    document.body.removeChild(contextMenu);
    editFeatureAttributes(layer, userLayer);
  });
  
  styleButton.addEventListener('click', () => {
    document.body.removeChild(contextMenu);
    openFeatureStyleDialog(layer, userLayer);
  });
  
  deleteButton.addEventListener('click', () => {
    document.body.removeChild(contextMenu);
    deleteFeature(layer, userLayer);
  });
  
  contextMenu.appendChild(editButton);
  contextMenu.appendChild(styleButton);
  contextMenu.appendChild(deleteButton);
  
  document.body.appendChild(contextMenu);
  
  setTimeout(() => {
    window.addEventListener('click', function closeMenu(e) {
      if (!contextMenu.contains(e.target)) {
        if (document.body.contains(contextMenu)) {
          document.body.removeChild(contextMenu);
        }
        window.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

function openFeatureStyleDialog(layer, userLayer) {
  const existingModal = document.getElementById('style-dialog');
  if (existingModal) {
    document.body.removeChild(existingModal);
  }

  const template = document.getElementById('style-dialog-template');
  const dialog = document.importNode(template.content, true).querySelector('#style-dialog');
  
  dialog.querySelector('#style-dialog-title').textContent = `Style Feature`;
  
  let hasPolygons = false;
  
  if (layer.feature && layer.feature.geometry) {
    const geomType = layer.feature.geometry.type;
    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      hasPolygons = true;
    }
  }
  
  const currentStyle = layer.options || {};
  const featureColor = dialog.querySelector('#feature-color');
  featureColor.value = currentStyle.color || userLayer.defaultColor || '#000000';
  
  const featureOpacity = dialog.querySelector('#feature-opacity');
  featureOpacity.value = (currentStyle.opacity !== undefined ? currentStyle.opacity : userLayer.strokeOpacity || 0.75) * 100;
  dialog.querySelector('#feature-opacity-value').textContent = `${featureOpacity.value}%`;
  
  const featureSize = dialog.querySelector('#feature-size');
  featureSize.value = currentStyle.weight || userLayer.weight || 3;
  dialog.querySelector('#feature-size-value').textContent = featureSize.value;
  
  const fillOptions = dialog.querySelector('.fill-options');
  if (fillOptions) {
    fillOptions.style.display = hasPolygons ? 'block' : 'none';
  }
  
  const featureFillColor = dialog.querySelector('#feature-fill-color');
  featureFillColor.value = currentStyle.fillColor || userLayer.fillColor || userLayer.defaultColor || '#000000';
  
  const featureFillOpacity = dialog.querySelector('#feature-fill-opacity');
  featureFillOpacity.value = (currentStyle.fillOpacity !== undefined ? currentStyle.fillOpacity : userLayer.fillOpacity || 0.3) * 100;
  dialog.querySelector('#feature-fill-opacity-value').textContent = `${featureFillOpacity.value}%`;
  
  const labelField = dialog.querySelector('#label-field');
  if (userLayer.fieldNames) {
    labelField.innerHTML = '<option value="">None</option>';
    userLayer.fieldNames.forEach(field => {
      const option = document.createElement('option');
      option.value = field;
      option.textContent = field;
      if (layer._customLabelField && layer._customLabelField === field) {
        option.selected = true;
      } else if (userLayer.labelField === field && !layer._customLabelField) {
        option.selected = true;
      }
      labelField.appendChild(option);
    });
  }
  
  const labelColor = dialog.querySelector('#label-color');
  labelColor.value = layer._customLabelColor || userLayer.labelColor || '#000000';
  
  const labelOpacity = dialog.querySelector('#label-opacity');
  labelOpacity.value = (layer._customLabelOpacity !== undefined ? layer._customLabelOpacity : userLayer.labelOpacity || 1) * 100;
  dialog.querySelector('#label-opacity-value').textContent = `${labelOpacity.value}%`;
  
  const labelSize = dialog.querySelector('#label-size');
  labelSize.value = layer._customLabelSize || userLayer.labelSize || 12;
  dialog.querySelector('#label-size-value').textContent = `${labelSize.value}px`;
  
  featureOpacity.addEventListener('input', function() {
    dialog.querySelector('#feature-opacity-value').textContent = `${this.value}%`;
  });
  
  featureSize.addEventListener('input', function() {
    dialog.querySelector('#feature-size-value').textContent = this.value;
  });
  
  featureFillOpacity.addEventListener('input', function() {
    dialog.querySelector('#feature-fill-opacity-value').textContent = `${this.value}%`;
  });
  
  labelOpacity.addEventListener('input', function() {
    dialog.querySelector('#label-opacity-value').textContent = `${this.value}%`;
  });
  
  labelSize.addEventListener('input', function() {
    dialog.querySelector('#label-size-value').textContent = `${this.value}px`;
  });
  
  dialog.querySelector('#apply-style').addEventListener('click', function() {
    const styleOptions = {
      color: featureColor.value,
      weight: parseInt(featureSize.value),
      opacity: featureOpacity.value / 100
    };
    
    if (hasPolygons) {
      styleOptions.fillColor = featureFillColor.value;
      styleOptions.fillOpacity = featureFillOpacity.value / 100;
    }
    
    layer._customStyle = styleOptions;
    layer.setStyle(styleOptions);
    
    layer._customLabelField = labelField.value;
    layer._customLabelColor = labelColor.value;
    layer._customLabelOpacity = labelOpacity.value / 100;
    layer._customLabelSize = parseInt(labelSize.value);
    
    applyFeatureLabelStyle(layer, userLayer);
    
    hasUnsavedChanges = true;
    document.body.removeChild(dialog);
  });
  
  dialog.querySelector('#cancel-style').addEventListener('click', function() {
    document.body.removeChild(dialog);
  });
  
  document.body.appendChild(dialog);
}

function applyFeatureLabelStyle(layer, userLayer) {
  if (layer._labelMarker && map.hasLayer(layer._labelMarker)) {
    map.removeLayer(layer._labelMarker);
    layer._labelMarker = null;
  }
  
  const labelField = layer._customLabelField || userLayer.labelField;
  
  if (labelField && labelField !== '' && layer.feature && 
      layer.feature.properties && layer.feature.properties[labelField] !== undefined) {
    
    const labelValue = layer.feature.properties[labelField];
    
    let labelPosition;
    if (layer.getLatLng) {
      labelPosition = layer.getLatLng();
    } else if (layer.getCenter) {
      labelPosition = layer.getCenter();
    } else {
      const geojsonFeature = layer.toGeoJSON();
      if (geojsonFeature) {
        const centroid = turf.center(geojsonFeature);
        labelPosition = L.latLng(centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]);
      }
    }
    
    if (labelPosition) {
      const color = layer._customLabelColor || userLayer.labelColor || '#000000';
      const opacity = layer._customLabelOpacity !== undefined ? 
                      layer._customLabelOpacity : 
                      (userLayer.labelOpacity !== undefined ? userLayer.labelOpacity : 1);
      const size = layer._customLabelSize || userLayer.labelSize || 12;
      
      const labelIcon = L.divIcon({
        className: 'user-layer-label',
        html: `<div style="color:${color}; opacity:${opacity}; font-size:${size}px; 
               text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;">
               ${labelValue}</div>`,
        iconSize: [100, 40],
        iconAnchor: [50, 20]
      });
      
      const labelMarker = L.marker(labelPosition, {
        icon: labelIcon,
        interactive: false,
        pane: 'userLayers'
      });
      
      if (!userLayer.labelLayerGroup) {
        userLayer.labelLayerGroup = L.layerGroup().addTo(map);
      }
      
      userLayer.labelLayerGroup.addLayer(labelMarker);
      
      layer._labelMarker = labelMarker;
    }
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function editFeatureAttributes(layer, userLayer) {
  if (!layer.feature || !layer.feature.properties) {
    layer.feature = {
      type: 'Feature',
      properties: { ...defaultAttributes },
      geometry: layer.toGeoJSON().geometry
    };
  }
  
  openAttributeEditor(layer.feature, userLayer.id);
}

function deleteFeature(layer, userLayer) {
  if (confirm('Are you sure you want to delete this feature?')) {
    userLayer.layer.removeLayer(layer);
    hasUnsavedChanges = true;
    
    const saveDrawingBtn = document.getElementById('saveDrawingBtn');
    if (saveDrawingBtn) {
      saveDrawingBtn.disabled = false;
    }
  }
}

function addContextMenuStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .feature-context-menu {
      min-width: 150px;
    }
    .feature-context-menu button:hover {
      background-color: #f0f0f0;
    }
  `;
  document.head.appendChild(styleElement);
}

function setupDrawingTools() {
  // console.log('Setting up drawing tools...');
  
  const drawPointBtn = document.getElementById('drawPointBtn');
  const drawLineBtn = document.getElementById('drawLineBtn');
  const drawPolygonBtn = document.getElementById('drawPolygonBtn');
  const saveDrawingBtn = document.getElementById('saveDrawingBtn');
  const drawingNameInput = document.getElementById('drawingNameInput');
  const saveDrawingContainer = document.getElementById('save-drawing-container');
  
  let originalLayerState = null;
  let hasUnsavedChanges = false;
  
  if (saveDrawingContainer) {
    saveDrawingContainer.style.display = 'none';
  }
  
  if (!drawFeatureGroup) {
    drawFeatureGroup = L.featureGroup().addTo(map);
  }
  
  const drawControl = new L.Control.Draw({
    draw: {
      polyline: {
        shapeOptions: {
          color: '#3388ff',
          weight: 4
        }
      },
      polygon: {
        shapeOptions: {
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.2
        },
        allowIntersection: false
      },
      circle: false,
      rectangle: false,
      marker: {}
    },
    edit: {
      featureGroup: drawFeatureGroup
    }
  });
  
  function resetShapeModes() {
    if (drawPointBtn) drawPointBtn.classList.remove('active');
    if (drawLineBtn) drawLineBtn.classList.remove('active');
    if (drawPolygonBtn) drawPolygonBtn.classList.remove('active');
    
    if (map.drawHandler && activeShapeMode === 'marker') {
      map.off('click', map.drawHandler);
      map.drawHandler = null;
    }
    
    if (map.activeDrawingTool && (activeShapeMode === 'polyline' || activeShapeMode === 'polygon')) {
      map.activeDrawingTool.disable();
      map.activeDrawingTool = null;
    }
    
    activeShapeMode = null;
    
    updateDrawingNameInputState();
  }
  
  function updateDrawingInstructions() {
    const instructions = document.getElementById('drawing-instructions');
    if (!instructions) return;
    
    let instructionText = '';
    
    if (activeShapeMode === 'marker') {
      instructionText = 'Click on map to place points.';
    } else if (activeShapeMode === 'polyline') {
      instructionText = 'Click to draw line. Double-click to finish line.';
    } else if (activeShapeMode === 'polygon') {
      instructionText = 'Click to start drawing polygon. Close shape to finish.';
    }
    
    if (activeActionMode === 'edit') {
      if (instructionText) instructionText += ' ';
      instructionText += 'Click a feature to edit. Drag handles to modify.';
    } else if (activeActionMode === 'delete') {
      if (instructionText) instructionText += ' ';
      instructionText += 'Click features to delete them.';
    }
    
    instructionText += ' Click Save when finished or ESC to cancel ' + 
      (activeShapeMode && activeActionMode ? 'current action' : 'drawing');
    
    instructions.textContent = instructionText;
    instructions.style.display = 'block';
  }
  
  function updateDrawingNameInputState() {
    const drawingNameInput = document.getElementById('drawingNameInput');
    const saveDrawingBtn = document.getElementById('saveDrawingBtn');
    
    if (!drawingNameInput || !saveDrawingBtn) return;
    
    if (currentEditingUserLayer) {
      drawingNameInput.disabled = true;
      drawingNameInput.style.opacity = '0.6';
      drawingNameInput.style.backgroundColor = '#f0f0f0';
      drawingNameInput.value = currentEditingUserLayer.name || '';
      saveDrawingBtn.disabled = activeActionMode === 'delete';
    } 
    else if (activeShapeMode || hasUnsavedChanges) {
      drawingNameInput.disabled = false;
      drawingNameInput.style.opacity = '1';
      drawingNameInput.style.backgroundColor = '#ffffff';
      if (!drawingNameInput.value) {
        drawingNameInput.value = `User Layer ${userLayerCount + 1}`;
      }
      saveDrawingBtn.disabled = activeActionMode === 'delete';
    } 
    else if (activeActionMode && !activeShapeMode) {
      drawingNameInput.disabled = true;
      drawingNameInput.style.opacity = '0.6';
      drawingNameInput.style.backgroundColor = '#f0f0f0';
      saveDrawingBtn.disabled = activeActionMode === 'delete' ? true : !hasUnsavedChanges;
    }
    else {
      drawingNameInput.disabled = false;
      drawingNameInput.style.opacity = '1';
      drawingNameInput.style.backgroundColor = '#ffffff';
      drawingNameInput.value = '';
      saveDrawingBtn.disabled = false;
    }
    
    const saveDrawingContainer = document.getElementById('save-drawing-container');
    if (saveDrawingContainer) {
      saveDrawingContainer.style.display = (activeShapeMode || activeActionMode || hasUnsavedChanges) ? 'flex' : 'none';
    }
  }
  
  function restoreOriginalState() {
    if (!originalLayerState && !hasUnsavedChanges) return;
  
    if (activeActionMode === 'delete' || activeActionMode === 'edit') {
      userLayers.forEach(userLayer => {
        if (userLayer._originalState && userLayer.layer) {
          map.removeLayer(userLayer.layer);
          
          userLayer.layer = L.geoJSON(userLayer._originalState, {
            pane: 'userLayers',
            style: function() {
              return {
                color: userLayer.defaultColor || '#000000',
                weight: userLayer.weight || 3,
                opacity: userLayer.strokeOpacity || 0.75,
                fillColor: userLayer.fillColor || userLayer.defaultColor || '#000000',
                fillOpacity: userLayer.fillOpacity || 0.3
              };
            },
            onEachFeature: function(feature, layer) {
              if (feature.properties) {
                layer.on('click', function(e) {
                  if (isDrawingActive && activeShapeMode) {
                  } else {
                    let popupContent = '<table class="popup-table">';
                    popupContent += '<tr><th>Property</th><th>Value</th></tr>';
                    
                    for (const [key, value] of Object.entries(feature.properties)) {
                      if (value !== null && value !== undefined) {
                        popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                      }
                    }
                    
                    popupContent += '</table>';
                    layer.bindPopup(popupContent);
                  }
                });
              }
            },
            pointToLayer: function(feature, latlng) {
              return L.circleMarker(latlng, {
                radius: 3,
                fillColor: userLayer.defaultColor || '#000000',
                color: userLayer.defaultColor || '#000000',
                weight: 1,
                opacity: userLayer.strokeOpacity || 0.75,
                fillOpacity: userLayer.fillOpacity || 0.75
              });
            }
          }).addTo(map);
          
          delete userLayer._originalState;
        }
      });
    }
    
    if (originalLayerState) {
      if (originalLayerState.id && originalLayerState.data) {
        const userLayer = userLayers.find(l => l.id === originalLayerState.id);
        
        if (userLayer) {
          userLayer.originalData = JSON.parse(JSON.stringify(originalLayerState.data));
          userLayer.name = originalLayerState.name;
          
          if (map.hasLayer(userLayer.layer)) {
            map.removeLayer(userLayer.layer);
          }
          
          userLayer.layer = L.geoJSON(userLayer.originalData, {
            pane: 'userLayers',
            style: function() {
              return {
                color: userLayer.defaultColor || '#000000',
                weight: userLayer.weight || 3,
                opacity: userLayer.strokeOpacity || 0.75,
                fillColor: userLayer.fillColor || userLayer.defaultColor || '#000000',
                fillOpacity: userLayer.fillOpacity || 0.3
              };
            },
            onEachFeature: function(feature, layer) {
              if (feature.properties) {
                layer.on('click', function(e) {
                  if (isDrawingActive && activeShapeMode) {
                  } else {
                    let popupContent = '<table class="popup-table">';
                    popupContent += '<tr><th>Property</th><th>Value</th></tr>';
                    
                    for (const [key, value] of Object.entries(feature.properties)) {
                      if (value !== null && value !== undefined) {
                        popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                      }
                    }
                    
                    popupContent += '</table>';
                    layer.bindPopup(popupContent);
                  }
                });
              }
            },
            pointToLayer: function(feature, latlng) {
              return L.circleMarker(latlng, {
                radius: 3,
                fillColor: userLayer.defaultColor || '#000000',
                color: userLayer.defaultColor || '#000000',
                weight: 1,
                opacity: userLayer.strokeOpacity || 0.75,
                fillOpacity: userLayer.fillOpacity || 0.75
              });
            }
          }).addTo(map);
        }
      } else if (originalLayerState.drawn) {
        drawFeatureGroup.clearLayers();
        
        L.geoJSON(originalLayerState.data, {
          onEachFeature: (feature, layer) => {
            drawFeatureGroup.addLayer(layer);
          }
        });
      }
    }
    
    originalLayerState = null;
    currentEditingUserLayer = null;
    currentDrawingLayer = null;
    hasUnsavedChanges = false;
  }
  
  function isDrawingOrActionActive() {
    return activeShapeMode !== null || activeActionMode !== null;
  }
  
  function switchToDrawModeForEditing(drawType) {
    if (activeActionMode === 'edit' && currentEditingUserLayer) {
      isDrawingActive = true;
      currentDrawType = drawType;
      
      if (saveDrawingContainer) {
        saveDrawingContainer.style.display = 'flex';
      }
      
      if (drawingNameInput) {
        drawingNameInput.value = currentEditingUserLayer.name || '';
        drawingNameInput.disabled = true;
        drawingNameInput.style.opacity = '0.6';
        drawingNameInput.style.backgroundColor = '#f0f0f0';
      }
    }
  }
  
  if (drawPointBtn) {
    drawPointBtn.addEventListener('click', function() {
      if (activeActionMode === 'edit' && currentEditingUserLayer) {
        switchToDrawModeForEditing('marker');
      }
      if (activeShapeMode === 'marker') {
        resetShapeModes();
        if (!activeActionMode) {
          isDrawingActive = false;
          currentDrawType = null;
          if (saveDrawingContainer) {
            saveDrawingContainer.style.display = 'none';
          }
          
          const instructions = document.getElementById('drawing-instructions');
          if (instructions) {
            instructions.style.display = 'none';
          }
        } else {
          updateDrawingInstructions();
        }
        return;
      }
      
      resetShapeModes();
      
      this.classList.add('active');
      isDrawingActive = true;
      currentDrawType = 'marker';
      activeShapeMode = 'marker';
      
      if (saveDrawingContainer) {
        saveDrawingContainer.style.display = 'flex';
      }
      
      map.drawHandler = function(e) {
        const marker = L.marker(e.latlng).addTo(drawFeatureGroup);
        
        if (activeActionMode === 'delete') {
          marker.on('click', function(evt) {
            L.DomEvent.stopPropagation(evt);
            drawFeatureGroup.removeLayer(marker);
            hasUnsavedChanges = true;
          });
        }
        
        if (activeActionMode === 'edit' && marker.editing) {
          marker.editing.enable();
          marker.on('click', function() {
            currentDrawingLayer = this;
            if (drawingNameInput && !currentEditingUserLayer) {
              drawingNameInput.value = 'Drawn Feature';
              drawingNameInput.disabled = false;
              drawingNameInput.style.opacity = '1';
              drawingNameInput.style.backgroundColor = '#ffffff';
            }
          });
        }
        
        hasUnsavedChanges = true;
      };
      
      map.on('click', map.drawHandler);
      
      updateDrawingInstructions();
      updateDrawingNameInputState();
    });
  }
  
  if (drawLineBtn) {
    drawLineBtn.addEventListener('click', function() {
      if (activeActionMode === 'edit' && currentEditingUserLayer) {
        switchToDrawModeForEditing('polyline');
      }
      if (activeShapeMode === 'polyline') {
        resetShapeModes();
        if (!activeActionMode) {
          isDrawingActive = false;
          currentDrawType = null;
          if (saveDrawingContainer) {
            saveDrawingContainer.style.display = 'none';
          }
          
          const instructions = document.getElementById('drawing-instructions');
          if (instructions) {
            instructions.style.display = 'none';
          }
        } else {
          updateDrawingInstructions();
        }
        return;
      }
      
      resetShapeModes();
      
      this.classList.add('active');
      isDrawingActive = true;
      currentDrawType = 'polyline';
      activeShapeMode = 'polyline';
      
      if (saveDrawingContainer) {
        saveDrawingContainer.style.display = 'flex';
      }
      
      map.activeDrawingTool = new L.Draw.Polyline(map, drawControl.options.draw.polyline);
      map.activeDrawingTool.enable();
      
      updateDrawingInstructions();
      updateDrawingNameInputState();
    });
  }
  
  if (drawPolygonBtn) {
    drawPolygonBtn.addEventListener('click', function() {
      if (activeActionMode === 'edit' && currentEditingUserLayer) {
        switchToDrawModeForEditing('polygon');
      }
      if (activeShapeMode === 'polygon') {
        resetShapeModes();
        if (!activeActionMode) {
          isDrawingActive = false;
          currentDrawType = null;
          if (saveDrawingContainer) {
            saveDrawingContainer.style.display = 'none';
          }
          
          const instructions = document.getElementById('drawing-instructions');
          if (instructions) {
            instructions.style.display = 'none';
          }
        } else {
          updateDrawingInstructions();
        }
        return;
      }
      
      resetShapeModes();
      
      this.classList.add('active');
      isDrawingActive = true;
      currentDrawType = 'polygon';
      activeShapeMode = 'polygon';
      
      if (saveDrawingContainer) {
        saveDrawingContainer.style.display = 'flex';
      }
      
      map.activeDrawingTool = new L.Draw.Polygon(map, drawControl.options.draw.polygon);
      map.activeDrawingTool.enable();
      
      updateDrawingInstructions();
      updateDrawingNameInputState();
    });
  }
  
  if (saveDrawingBtn) {
    saveDrawingBtn.addEventListener('click', function() {
      const name = drawingNameInput.value.trim() || `Drawing ${userLayerCount + 1}`;
      
      if (currentEditingUserLayer && activeActionMode === 'edit') {
        if (!drawingNameInput.disabled && currentEditingUserLayer.name !== name) {
          currentEditingUserLayer.name = name;
          
          const layerElement = document.querySelector(`.user-layer-item button[data-id="${currentEditingUserLayer.id}"]`).closest('.user-layer-item');
          if (layerElement) {
            const nameSpan = layerElement.querySelector('span');
            if (nameSpan) {
              nameSpan.textContent = name.length > 15 ? name.substring(0, 15) + '...' : name;
              nameSpan.title = name;
            }
          }
        }
        
        currentEditingUserLayer.layer.eachLayer(layer => {
          if (layer.editing && layer.editing.enabled()) {
            layer.editing.disable();
          }
        });
        
        const currentLayerGeoJSON = currentEditingUserLayer.layer.toGeoJSON();
        
        currentEditingUserLayer.layer.eachLayer(layer => {
          const featureIndex = currentLayerGeoJSON.features.findIndex(f => 
            JSON.stringify(f.geometry) === JSON.stringify(layer.toGeoJSON().geometry));
          
          if (featureIndex !== -1 && layer._customStyle) {
            currentLayerGeoJSON.features[featureIndex].properties._customStyle = layer._customStyle;
            currentLayerGeoJSON.features[featureIndex].properties._customLabelField = layer._customLabelField;
            currentLayerGeoJSON.features[featureIndex].properties._customLabelColor = layer._customLabelColor;
            currentLayerGeoJSON.features[featureIndex].properties._customLabelOpacity = layer._customLabelOpacity;
            currentLayerGeoJSON.features[featureIndex].properties._customLabelSize = layer._customLabelSize;
          }
        });

        const newFeatures = [];
        drawFeatureGroup.eachLayer(layer => {
          if (layer._userLayerId === currentEditingUserLayer.id) {
            const featureGeoJSON = layer.toGeoJSON();
            
            if (layer._customStyle) {
              featureGeoJSON.properties._customStyle = layer._customStyle;
            }
            if (layer._customLabelField) {
              featureGeoJSON.properties._customLabelField = layer._customLabelField;
            }
            if (layer._customLabelColor) {
              featureGeoJSON.properties._customLabelColor = layer._customLabelColor;
            }
            if (layer._customLabelOpacity !== undefined) {
              featureGeoJSON.properties._customLabelOpacity = layer._customLabelOpacity;
            }
            if (layer._customLabelSize) {
              featureGeoJSON.properties._customLabelSize = layer._customLabelSize;
            }
            
            newFeatures.push(featureGeoJSON);
          }
        });
        
        if (newFeatures.length > 0) {
          currentLayerGeoJSON.features = [...currentLayerGeoJSON.features, ...newFeatures];
        }
        
        currentEditingUserLayer.originalData = currentLayerGeoJSON;
        
        map.removeLayer(currentEditingUserLayer.layer);
        if (currentEditingUserLayer.labelLayerGroup) {
          map.removeLayer(currentEditingUserLayer.labelLayerGroup);
        }
        
        currentEditingUserLayer.layer = L.geoJSON(currentLayerGeoJSON, {
          pane: 'userLayers',
          style: function(feature) {
            if (feature.properties && feature.properties._customStyle) {
              return feature.properties._customStyle;
            }
            
            return {
              color: currentEditingUserLayer.defaultColor || '#000000',
              weight: currentEditingUserLayer.weight || 3,
              opacity: currentEditingUserLayer.strokeOpacity || 0.75,
              fillColor: currentEditingUserLayer.fillColor || currentEditingUserLayer.defaultColor || '#000000',
              fillOpacity: currentEditingUserLayer.fillOpacity || 0.3
            };
          },
          onEachFeature: function(feature, layer) {
            if (feature.properties) {
              if (feature.properties._customStyle) {
                layer._customStyle = feature.properties._customStyle;
              }
              if (feature.properties._customLabelField) {
                layer._customLabelField = feature.properties._customLabelField;
              }
              if (feature.properties._customLabelColor) {
                layer._customLabelColor = feature.properties._customLabelColor;
              }
              if (feature.properties._customLabelOpacity !== undefined) {
                layer._customLabelOpacity = feature.properties._customLabelOpacity;
              }
              if (feature.properties._customLabelSize) {
                layer._customLabelSize = feature.properties._customLabelSize;
              }
              
              layer.on('click', function(e) {
                if (isDrawingActive && activeShapeMode) {
                } else {
                  L.DomEvent.stopPropagation(e);
                  const popupContent = createFeaturePopupContent(feature.properties, currentEditingUserLayer.name);
                  L.popup()
                    .setLatLng(e.latlng)
                    .setContent(popupContent)
                    .openOn(map);
                }
              });
            }
          },
          pointToLayer: function(feature, latlng) {
            const style = feature.properties._customStyle || {
              radius: 3,
              fillColor: currentEditingUserLayer.defaultColor || '#000000',
              color: currentEditingUserLayer.defaultColor || '#000000',
              weight: 1,
              opacity: currentEditingUserLayer.strokeOpacity || 0.75,
              fillOpacity: currentEditingUserLayer.fillOpacity || 0.75
            };
            
            return L.circleMarker(latlng, style);
          }
        }).addTo(map);
        
        applyUserLayerStyle(currentEditingUserLayer.id);
        
        drawFeatureGroup.eachLayer(layer => {
          if (layer._userLayerId === currentEditingUserLayer.id) {
            drawFeatureGroup.removeLayer(layer);
          }
        });
        
        currentEditingUserLayer.editEnabled = false;
        currentEditingUserLayer = null;
        currentDrawingLayer = null;
        originalLayerState = null;
        hasUnsavedChanges = false;
        
        resetAllModes();
        if (drawingNameInput) {
          drawingNameInput.value = '';
          drawingNameInput.disabled = false;
          drawingNameInput.style.opacity = '1';
          drawingNameInput.style.backgroundColor = '#ffffff';
        }
        
        return;
      }
      
      if (drawFeatureGroup.getLayers().length > 0) {
        const drawnItemsGeoJSON = drawFeatureGroup.toGeoJSON();
        
        if (currentEditingUserLayer) {
          const existingData = currentEditingUserLayer.originalData;
          
          drawnItemsGeoJSON.features.forEach(feature => {
            existingData.features.push(feature);
          });
          
          map.removeLayer(currentEditingUserLayer.layer);
          if (currentEditingUserLayer.labelLayerGroup) {
            map.removeLayer(currentEditingUserLayer.labelLayerGroup);
          }
          
          currentEditingUserLayer.layer = L.geoJSON(existingData, {
            pane: 'userLayers',
            style: function() {
              return {
                color: currentEditingUserLayer.defaultColor || '#000000',
                weight: currentEditingUserLayer.weight || 3,
                opacity: currentEditingUserLayer.strokeOpacity || 0.75,
                fillColor: currentEditingUserLayer.fillColor || currentEditingUserLayer.defaultColor || '#000000',
                fillOpacity: currentEditingUserLayer.fillOpacity || 0.3
              };
            },
            onEachFeature: function(feature, layer) {
              if (feature.properties) {
                layer.on('click', function(e) {
                  if (isDrawingActive && activeShapeMode) {
                  } else {
                    layer.on('click', function(e) {
                      if (!isDrawingActive) {
                        L.DomEvent.stopPropagation(e);
                        const popupContent = createFeaturePopupContent(feature.properties, currentEditingUserLayer.name);
                        layer.bindPopup(popupContent).openPopup();
                      }
                    });
                  }
                });
              }
            },
            pointToLayer: function(feature, latlng) {
              return L.circleMarker(latlng, {
                radius: 3,
                fillColor: currentEditingUserLayer.defaultColor || '#000000',
                color: currentEditingUserLayer.defaultColor || '#000000',
                weight: 1,
                opacity: currentEditingUserLayer.strokeOpacity || 0.75,
                fillOpacity: currentEditingUserLayer.fillOpacity || 0.75
              });
            }
          }).addTo(map);
          
          currentEditingUserLayer.originalData = existingData;
          
          applyUserLayerStyle(currentEditingUserLayer.id);
        } else {
          addUserLayer(drawnItemsGeoJSON, name);
        }
        
        drawFeatureGroup.clearLayers();
        currentDrawingLayer = null;
        originalLayerState = null;
        hasUnsavedChanges = false;
        currentEditingUserLayer = null;
        
        resetAllModes();
        if (drawingNameInput) {
          drawingNameInput.value = '';
          drawingNameInput.disabled = false;
          drawingNameInput.style.opacity = '1';
          drawingNameInput.style.backgroundColor = '#ffffff';
        }
      } else if (activeActionMode === 'edit' && hasUnsavedChanges) {
        if (currentEditingUserLayer) {
          currentEditingUserLayer.layer.eachLayer(layer => {
            if (layer.editing && layer.editing.enabled()) {
              layer.editing.disable();
            }
          });
          currentEditingUserLayer.editEnabled = false;
        }
        
        resetAllModes();
        if (drawingNameInput) {
          drawingNameInput.value = '';
          drawingNameInput.disabled = false;
          drawingNameInput.style.opacity = '1';
          drawingNameInput.style.backgroundColor = '#ffffff';
        }
        hasUnsavedChanges = false;
        originalLayerState = null;
        currentEditingUserLayer = null;
      } else {
        alert('No features drawn or edited. Please draw or edit something first.');
      }
    });
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isDrawingOrActionActive()) {
      e.preventDefault();
      
      if (activeActionMode === 'delete' || activeActionMode === 'edit') {
        restoreOriginalState();
        
        if (activeShapeMode) {
          resetShapeModes();
          activeActionMode = null;
        } else {
          resetAllModes();
        }
      } else if (activeShapeMode) {
        if (hasUnsavedChanges) {
          if (confirm('Discard unsaved changes?')) {
            drawFeatureGroup.clearLayers();
            resetAllModes();
          }
        } else {
          resetAllModes();
        }
      }
      
      if (!activeShapeMode) {
        currentDrawingLayer = null;
        currentEditingUserLayer = null;
        
        if (drawingNameInput) {
          drawingNameInput.value = '';
          drawingNameInput.disabled = false;
          drawingNameInput.style.opacity = '1';
          drawingNameInput.style.backgroundColor = '#ffffff';
        }
      }
    }
  });
  
  map.on('draw:created', function(e) {
    const layer = e.layer;
    
    let initialAttributes = {...defaultAttributes};
    
    if (currentEditingUserLayer) {
      layer._userLayerId = currentEditingUserLayer.id;
      
      const existingFeatures = currentEditingUserLayer.layer.getLayers();
      if (existingFeatures.length > 0) {
        const lastFeature = existingFeatures[existingFeatures.length - 1];
        if (lastFeature.feature && lastFeature.feature.properties) {
          initialAttributes = {...lastFeature.feature.properties};
        }
      }
    } else if (drawFeatureGroup.getLayers().length > 0) {
      const lastFeature = drawFeatureGroup.getLayers()[drawFeatureGroup.getLayers().length - 1];
      if (lastFeature.feature && lastFeature.feature.properties) {
        initialAttributes = {...lastFeature.feature.properties};
      }
    }
    
    const feature = layer.toGeoJSON();
    feature.properties = initialAttributes;
    layer.feature = feature;
    
    currentDrawingLayer = layer;
    
    if (activeActionMode === 'edit' && currentEditingUserLayer) {
      if (layer.setStyle) {
        layer.setStyle({
          color: currentEditingUserLayer.defaultColor || '#000000',
          weight: currentEditingUserLayer.weight || 3,
          opacity: currentEditingUserLayer.strokeOpacity || 0.75,
          fillColor: currentEditingUserLayer.fillColor || currentEditingUserLayer.defaultColor || '#000000',
          fillOpacity: currentEditingUserLayer.fillOpacity || 0.3
        });
      } else if (layer.setRadius) {
        layer.setStyle({
          radius: 3,
          fillColor: currentEditingUserLayer.defaultColor || '#000000',
          color: currentEditingUserLayer.defaultColor || '#000000',
          weight: 1,
          opacity: currentEditingUserLayer.strokeOpacity || 0.75,
          fillOpacity: currentEditingUserLayer.fillOpacity || 0.75
        });
      }
    }
    
    drawFeatureGroup.addLayer(layer);
    
    openAttributeEditor(feature);
    
    hasUnsavedChanges = true;
    
    if (activeActionMode === 'delete') {
      layer.on('click', function(evt) {
        L.DomEvent.stopPropagation(evt);
        drawFeatureGroup.removeLayer(layer);
        hasUnsavedChanges = true;
      });
    }
    
    if (activeActionMode === 'edit' && layer.editing) {
      layer.editing.enable();
      layer.on('click', function() {
        currentDrawingLayer = this;
        if (drawingNameInput && !currentEditingUserLayer) {
          drawingNameInput.value = 'Drawn Feature';
          drawingNameInput.disabled = false;
          drawingNameInput.style.opacity = '1';
          drawingNameInput.style.backgroundColor = '#ffffff';
        } else if (drawingNameInput && currentEditingUserLayer) {
          drawingNameInput.value = currentEditingUserLayer.name || '';
          drawingNameInput.disabled = true;
          drawingNameInput.style.opacity = '0.6';
          drawingNameInput.style.backgroundColor = '#f0f0f0';
        }
      });
    }
    
    if (saveDrawingContainer) {
      saveDrawingContainer.style.display = 'flex';
    }
  });
  
  map.on('draw:edited', function(e) {
    if (saveDrawingContainer) {
      saveDrawingContainer.style.display = 'flex';
    }
    hasUnsavedChanges = true;
  });
  
  map.on('draw:deleted', function(e) {
    if (drawFeatureGroup.getLayers().length === 0) {
      if (saveDrawingContainer) {
        saveDrawingContainer.style.display = 'none';
      }
      currentDrawingLayer = null;
    }
    hasUnsavedChanges = true;
  });
}

function openAttributeEditor(feature, layerId) {
  pendingFeature = feature;
  currentUserLayerId = layerId;
  
  currentFeatureAttributes = feature.properties ? {...feature.properties} : {...defaultAttributes};
  
  const container = document.getElementById('attribute-fields-container');
  container.innerHTML = '';
  
  const nameField = document.createElement('div');
  nameField.className = 'attribute-field';
  nameField.innerHTML = `
    <div class="field-row">
      <input type="text" class="attribute-name" value="Name" readonly>
      <input type="text" class="attribute-value" placeholder="Enter name..." value="${currentFeatureAttributes.Name || ''}">
    </div>
  `;
  container.appendChild(nameField);
  
  Object.entries(currentFeatureAttributes).forEach(([key, value]) => {
    if (key !== 'Name') {
      addAttributeField(key, value);
    }
  });
  
  document.getElementById('attribute-editor-modal').style.display = 'block';
}

function addAttributeField(name = '', value = '') {
  const container = document.getElementById('attribute-fields-container');
  const field = document.createElement('div');
  field.className = 'attribute-field';
  field.innerHTML = `
    <div class="field-row">
      <input type="text" class="attribute-name" value="${name}" placeholder="Attribute name">
      <input type="text" class="attribute-value" value="${value}" placeholder="Value">
      <button type="button" class="remove-attribute">&times;</button>
    </div>
  `;
  
  const removeBtn = field.querySelector('.remove-attribute');
  removeBtn.addEventListener('click', function() {
    container.removeChild(field);
  });
  
  container.appendChild(field);
}

function saveAttributes() {
  const attributeFields = document.querySelectorAll('.attribute-field');
  const attributes = {};
  
  attributeFields.forEach(field => {
    const nameInput = field.querySelector('.attribute-name');
    const valueInput = field.querySelector('.attribute-value');
    
    if (nameInput && valueInput && nameInput.value.trim()) {
      attributes[nameInput.value.trim()] = valueInput.value;
    }
  });
  
  if (pendingFeature) {
    pendingFeature.properties = attributes;
    
    if (currentUserLayerId) {
      const userLayer = userLayers.find(l => l.id === currentUserLayerId);
      if (userLayer && userLayer.currentDrawingLayer) {
        userLayer.currentDrawingLayer.feature = pendingFeature;
      }
    }
  }
  
  document.getElementById('attribute-editor-modal').style.display = 'none';
  
  pendingFeature = null;
  currentUserLayerId = null;
  currentFeatureAttributes = {};
  
  if (activeShapeMode) {
    continueDrawing();
  }
}

function cancelAttributeEditing() {
  if (pendingFeature && !pendingFeature.properties && currentUserLayerId) {
    const userLayer = userLayers.find(l => l.id === currentUserLayerId);
    if (userLayer && userLayer.layer && userLayer.currentDrawingLayer) {
      userLayer.layer.removeLayer(userLayer.currentDrawingLayer);
    }
  }
  
  document.getElementById('attribute-editor-modal').style.display = 'none';
  
  pendingFeature = null;
  currentUserLayerId = null;
  currentFeatureAttributes = {};
  
  if (activeShapeMode) {
    continueDrawing();
  }
}

function continueDrawing() {
  if (activeShapeMode === 'marker') {
  } 
  else if (activeShapeMode === 'polyline') {
    const polylineOptions = drawControl && drawControl.options ? 
      drawControl.options.draw.polyline : 
      {
        shapeOptions: {
          color: '#3388ff',
          weight: 4
        }
      };
      
    map.activeDrawingTool = new L.Draw.Polyline(map, polylineOptions);
    map.activeDrawingTool.enable();
  } 
  else if (activeShapeMode === 'polygon') {
    const polygonOptions = drawControl && drawControl.options ? 
      drawControl.options.draw.polygon : 
      {
        shapeOptions: {
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.2
        },
        allowIntersection: false
      };
      
    map.activeDrawingTool = new L.Draw.Polygon(map, polygonOptions);
    map.activeDrawingTool.enable();
  }
}

function populateUserLayerFilterValues(userLayer, fieldName) {
  // console.log('populateUserLayerFilterValues called from:');
  const filterValueContainer = document.getElementById('filterValueContainer');
  const filterCheckboxesSection = document.createElement('div');
  filterCheckboxesSection.className = 'filter-checkboxes-section';
  filterCheckboxesSection.style.marginTop = '10px';
  
  const existingCheckboxes = filterValueContainer.querySelector('.filter-checkboxes-section');
  if (existingCheckboxes) {
    filterValueContainer.removeChild(existingCheckboxes);
  }
  
  if (!fieldName) {
    const filterValueButton = document.getElementById('filterValueButton');
    if (filterValueButton) {
      filterValueButton.textContent = 'All features';
    }
    
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.display = 'none';
    
    const allFeaturesCheckbox = document.createElement('input');
    allFeaturesCheckbox.type = 'checkbox';
    allFeaturesCheckbox.id = 'all-features-filter';
    allFeaturesCheckbox.checked = true;
    allFeaturesCheckbox.className = 'filter-value-checkbox';
    allFeaturesCheckbox.value = 'All features';
    
    hiddenDiv.appendChild(allFeaturesCheckbox);
    filterCheckboxesSection.appendChild(hiddenDiv);
    filterValueContainer.appendChild(filterCheckboxesSection);

    updateSummaryStatistics(getCurrentFeatures());
    
    if (document.getElementById('highlightAreaCheckbox').checked) {
      highlightSelectedArea();
    }
    
    return;
  }

  const uniqueValues = new Set();
  userLayer.layer.eachLayer(layer => {
    if (layer.feature && layer.feature.properties && 
        layer.feature.properties[fieldName] !== undefined) {
      uniqueValues.add(String(layer.feature.properties[fieldName]));
    }
  });
  
  const values = Array.from(uniqueValues).sort();
  
  const selectAllLabel = document.createElement('label');
  selectAllLabel.className = 'checkbox-label';
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.id = 'select-all-filter';
  selectAllCheckbox.checked = true;
  
  const selectAllSpan = document.createElement('span');
  selectAllSpan.innerHTML = '<i>Select/Deselect All</i>';
  
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(selectAllSpan);
  filterCheckboxesSection.appendChild(selectAllLabel);
  
  const checkboxes = [];
  values.forEach((value, index) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `filter-${value.toString().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
    checkbox.value = value;
    checkbox.checked = true;
    checkbox.className = 'filter-value-checkbox';
    checkboxes.push(checkbox);
    
    const span = document.createElement('span');
    span.textContent = value;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    filterCheckboxesSection.appendChild(label);
    
    checkbox.addEventListener('change', function() {
      updateFilterButtonText();
      updateSummaryStatistics(getCurrentFeatures());
      
      if (document.getElementById('highlightAreaCheckbox').checked) {
        highlightSelectedArea();
      }
    });
  });
  
  selectAllCheckbox.addEventListener('change', function() {
    const isChecked = this.checked;
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateFilterButtonText();
    updateSummaryStatistics(getCurrentFeatures());
    
    if (document.getElementById('highlightAreaCheckbox').checked) {
      highlightSelectedArea();
    }
  });
  
  function updateFilterButtonText() {
    const selectedValues = checkboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    const filterValueButton = document.getElementById('filterValueButton');
    if (filterValueButton) {
      if (selectedValues.length === 0) {
        filterValueButton.textContent = '\u00A0';
      } else if (selectedValues.length === 1) {
        filterValueButton.textContent = selectedValues[0];
      } else if (selectedValues.length === values.length) {
        filterValueButton.textContent = 'All Values';
      } else {
        filterValueButton.textContent = `${selectedValues.length} values selected`;
      }
    }
  }
  
  filterValueContainer.appendChild(filterCheckboxesSection);
  updateFilterButtonText();
  
  updateSummaryStatistics(getCurrentFeatures());
  
  if (document.getElementById('highlightAreaCheckbox').checked) {
    highlightSelectedArea();
  }
}

function detectAndFixProjection(data) {
  if (!data || !data.features || !data.features.length) return data;
  
  const result = JSON.parse(JSON.stringify(data));
  
  const checkSampleCoordinates = () => {
    for (let i = 0; i < Math.min(5, data.features.length); i++) {
      const feature = data.features[i];
      if (!feature.geometry || !feature.geometry.coordinates) continue;
      
      let coord;
      if (feature.geometry.type === 'Point') {
        coord = feature.geometry.coordinates;
      } else if (['LineString', 'MultiPoint'].includes(feature.geometry.type)) {
        coord = feature.geometry.coordinates[0];
      } else if (['Polygon', 'MultiLineString'].includes(feature.geometry.type)) {
        coord = feature.geometry.coordinates[0][0];
      } else if (feature.geometry.type === 'MultiPolygon') {
        coord = feature.geometry.coordinates[0][0][0];
      }
      
      if (coord) {
        if (coord[0] > 100000 && coord[0] < 700000 && 
            coord[1] > 0 && coord[1] < 1300000) {
          console.log("Detected likely British National Grid coordinates:", coord);
          return 'EPSG:27700';
        }
        else if (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90) {
          console.log("Detected likely Web Mercator coordinates:", coord);
          return 'EPSG:3857';
        }
      }
    }
    return false;
  };
  
  const projectionType = checkSampleCoordinates();
  
  if (projectionType) {
    console.log(`Reprojecting from ${projectionType} to WGS84`);
    
    const sourceCrs = projectionType === 'EPSG:27700' 
      ? new L.Proj.CRS('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs')
      : L.CRS.EPSG3857;
    
    const targetCrs = L.CRS.EPSG4326;
    
    for (let i = 0; i < result.features.length; i++) {
      const feature = result.features[i];
      if (!feature.geometry || !feature.geometry.coordinates) continue;
      
      if (feature.geometry.type === 'Point') {
        const point = L.point(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        const latLng = sourceCrs.unproject(point);
        feature.geometry.coordinates = [latLng.lng, latLng.lat];
      } 
      else if (['LineString', 'MultiPoint'].includes(feature.geometry.type)) {
        feature.geometry.coordinates = feature.geometry.coordinates.map(coord => {
          const point = L.point(coord[0], coord[1]);
          const latLng = sourceCrs.unproject(point);
          return [latLng.lng, latLng.lat];
        });
      }
      else if (['Polygon', 'MultiLineString'].includes(feature.geometry.type)) {
        feature.geometry.coordinates = feature.geometry.coordinates.map(ring => 
          ring.map(coord => {
            const point = L.point(coord[0], coord[1]);
            const latLng = sourceCrs.unproject(point);
            return [latLng.lng, latLng.lat];
          })
        );
      }
      else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(polygon => 
          polygon.map(ring => ring.map(coord => {
            const point = L.point(coord[0], coord[1]);
            const latLng = sourceCrs.unproject(point);
            return [latLng.lng, latLng.lat];
          }))
        );
      }
    }
  }
  
  return result;
}


function removeUserLayer(layerId) {
  const layerIndex = userLayers.findIndex(l => l.id === layerId);
  if (layerIndex > -1) {
    const layer = userLayers[layerIndex];
    
    map.removeLayer(layer.layer);
    
    if (layer.labelLayerGroup) {
      map.removeLayer(layer.labelLayerGroup);
    }
    
    drawFeatureGroup.eachLayer(drawLayer => {
      if (drawLayer._userLayerId === layerId) {
        drawFeatureGroup.removeLayer(drawLayer);
      }
    });
    
    const layerGeoJSON = layer.layer.toGeoJSON();
    if (layerGeoJSON && layerGeoJSON.features) {
      layerGeoJSON.features.forEach(feature => {
        drawFeatureGroup.eachLayer(drawLayer => {
          const drawLayerGeoJSON = drawLayer.toGeoJSON();
          if (JSON.stringify(drawLayerGeoJSON.geometry) === JSON.stringify(feature.geometry)) {
            drawFeatureGroup.removeLayer(drawLayer);
          }
        });
      });
    }
    
    userLayers.splice(layerIndex, 1);
    
    const layerElement = document.querySelector(`.user-layer-item button[data-id="${layerId}"]`).closest('.user-layer-item');
    if (layerElement) {
      layerElement.remove();
    }
    
    updateFilterDropdown();
    
    if (filterTypeDropdown.value === `UserLayer_${layerId}`) {
      filterTypeDropdown.value = AmenitiesCatchmentLayer ? 'Range' : 'LA';
      updateFilterValues();
    }
  }
}

function isPanelOpen(panelName) {
  // console.log('Checking if panel is open...');
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
  for (const header of panelHeaders) {
    if (header.textContent.includes(panelName) && !header.classList.contains("collapsed")) {
      return true;
    }
  }
  return false;
}

function configureSlider(sliderElement, isInverse) {
  if (sliderElement.noUiSlider) {
    sliderElement.noUiSlider.off('update');
  }
  
  updateLayerStyles()

  const handles = sliderElement.querySelectorAll('.noUi-handle');
  const connectElements = sliderElement.querySelectorAll('.noUi-connect');

  if (handles.length >= 2) {
    handles[0].classList.add('noUi-handle-lower');
    handles[1].classList.add('noUi-handle-upper');
  }
  
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
    
    if (handles.length >= 2) {
      handles[1].classList.add('noUi-handle-transparent');
      handles[0].classList.remove('noUi-handle-transparent');
    }
    
    if (connectElements.length >= 3) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
      connectElements[1].classList.add('noUi-connect-gradient-left');
      connectElements[2].classList.remove('noUi-connect-dark-grey');
    }
  } else {
    sliderElement.noUiSlider.updateOptions({
      connect: [true, true, true]
    }, false);
    
    if (handles.length >= 2) {
      handles[0].classList.add('noUi-handle-transparent');
      handles[1].classList.remove('noUi-handle-transparent');
    }
    
    if (connectElements.length >= 3) {
      connectElements[0].classList.remove('noUi-connect-dark-grey');
      connectElements[1].classList.add('noUi-connect-gradient-right');
      connectElements[2].classList.add('noUi-connect-dark-grey');
    }
  }

  sliderElement.noUiSlider.on('update', function (values, handle) {
    const handleElement = handles[handle];
    const step = sliderElement.noUiSlider.options.step;
    const formattedValue = formatValue(values[handle], step);
    handleElement.setAttribute('data-value', formattedValue);
    
    if (!isUpdatingStyles) {
      isUpdatingStyles = true;
      requestAnimationFrame(() => {
        updateLayerStyles();
        isUpdatingStyles = false;
      });
    }
  });
}

function updateSliderRanges(type, scaleType) {
  // console.log('Updating slider ranges...');
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
    isUpdatingSliders = false;
    return;
  }
  
  if (hexesData) {
    const values = field !== "None" ? 
      hexesData.features.map(feature => feature.properties[field]).filter(value => value !== null && value !== 0) : [];
    
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

    configureSlider(rangeElement, isInverse);   
  }

  isUpdatingSliders = false;

  if (type === 'Scores' && ScoresLayer) {
    applyScoresLayerStyling();
  } else if (type === 'Amenities' && AmenitiesCatchmentLayer) {
    applyAmenitiesCatchmentLayerStyling();
  } else if (type === 'Census' && CensusLayer) {
    applyCensusLayerStyling();
  }
}

function initializeSliders(sliderElement) {
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
      to: value => parseFloat(value),
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

  configureSlider(sliderElement, false);
}

function initializeLayerTransparencySliderAmenities() {
  // Check if the element exists
  if (!LayerTransparencySliderAmenities) {
    return false;
  }

  if (LayerTransparencySliderAmenities.noUiSlider) {
    LayerTransparencySliderAmenities.noUiSlider.destroy();
  }

  try {
    noUiSlider.create(LayerTransparencySliderAmenities, {
      start: [50], // Start at 50% (middle position)
      connect: [true, false],
      range: {
        'min': 0,
        'max': 100
      },
      step: 5,
      tooltips: false,
      format: {
        to: value => Math.round(value),
        from: value => Math.round(value)
      }
    });

    // Update the transparency value when slider changes
    LayerTransparencySliderAmenities.noUiSlider.on('update', function (values) {
      layerTransparencyValue = parseFloat(values[0]) / 100; // Convert to 0-1 range
      if (LayerTransparencyValueAmenities) {
        LayerTransparencyValueAmenities.textContent = Math.round(values[0]) + '%';
      }
      throttledUpdateLayerTransparency();
    });

    // Style the slider
    const connectElements = LayerTransparencySliderAmenities.querySelectorAll('.noUi-connect');
    if (connectElements.length > 0) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
    }
    return true;
  } catch (error) {
    console.error('Error initializing layer transparency slider:', error);
    return false;
  }
}

function updateLayerTransparency() {
  // Update all layers when layer transparency changes - optimized to only update styling
  if (ScoresLayer) {
    applyScoresLayerStyling();
  }
  if (AmenitiesCatchmentLayer) {
    applyAmenitiesCatchmentLayerStyling();
  }
  if (CensusLayer) {
    applyCensusLayerStyling();
  }
}

function initializeLayerTransparencySliderScores() {
  // Check if the element exists
  if (!LayerTransparencySliderScores) {
    return false;
  }
  
  if (LayerTransparencySliderScores.noUiSlider) {
    LayerTransparencySliderScores.noUiSlider.destroy();
  }

  try {
    noUiSlider.create(LayerTransparencySliderScores, {
      start: [50], // Start at 50% (middle position)
      connect: [true, false],
      range: {
        'min': 0,
        'max': 100
      },
      step: 5,
      tooltips: false,
      format: {
        to: value => Math.round(value),
        from: value => Math.round(value)
      }
    });

    // Update the transparency value and display when slider changes
    LayerTransparencySliderScores.noUiSlider.on('update', function (values) {
      layerTransparencyValue = parseFloat(values[0]) / 100; // Convert to 0-1 range
      if (LayerTransparencyValueScores) {
        LayerTransparencyValueScores.textContent = Math.round(values[0]) + '%';
      }
      throttledUpdateLayerTransparency();
    });

    // Style the slider
    const connectElements = LayerTransparencySliderScores.querySelectorAll('.noUi-connect');
    if (connectElements.length > 0) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
    }
    return true;
  } catch (error) {
    console.error('Error initializing layer transparency slider for scores:', error);
    return false;
  }
}

function toggleInverseScale(type, scaleType) {
  // console.log('Toggling inverse scale...');
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
  
  configureSlider(rangeElement, isInverse);
  rangeElement.noUiSlider.set(currentValues, false);

  updateSliderRanges(type, scaleType);

  isUpdatingSliders = false;
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

  if (step >= 100) {
    return (Math.round(value / 100) * 100)
      .toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 10) {
    return (Math.round(value / 10) * 10)
      .toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 1) {
    return Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else if (step >= 0.1) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } else if (step >= 0.01) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return value.toString();
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
  if (isUpdatingVisibility) return;
  isUpdatingVisibility = true;

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
  
  isUpdatingVisibility = false;
}

function updateLegend() {
  // console.log('Updating legend...');
  const selectedYear = AmenitiesCatchmentLayer ? AmenitiesYear.value : ScoresYear.value;
  const legendContent = document.getElementById("legend-content");
  
  const dataLayerCategory = document.getElementById('data-layer-category');
  if (!dataLayerCategory) return;
  
  if (!ScoresLayer && !AmenitiesCatchmentLayer && !CensusLayer) {
    dataLayerCategory.style.display = 'none';
    return;
  } else {
    dataLayerCategory.style.display = '';
  }
  
  const legendCategoryHeader = dataLayerCategory.querySelector('.legend-category-header span');
  if (legendCategoryHeader) {
    if (ScoresLayer) {
      legendCategoryHeader.textContent = selectedYear.includes('-') ? "Score Difference" : "Population Percentiles";
    } else if (AmenitiesCatchmentLayer) {
      legendCategoryHeader.textContent = "Journey Time Catchment (minutes)";
    } else if (CensusLayer) {
      legendCategoryHeader.textContent = "Census / Local Plan Data";
    }
  }
  
  const wasCollapsed = dataLayerCategory.classList.contains('legend-category-collapsed');
  
  const checkboxStates = {};
  const legendCheckboxes = document.querySelectorAll('.legend-checkbox');
  legendCheckboxes.forEach(checkbox => {
    checkboxStates[checkbox.getAttribute('data-range')] = checkbox.checked;
  });

  legendContent.innerHTML = '';

  let classes;

  if (AmenitiesCatchmentLayer) {
    classes = [
      { range: `> 0 and <= 5`, color: "#fde725" },
      { range: `> 5 and <= 10`, color: "#8fd744" },
      { range: `> 10 and <= 15`, color: "#35b779" },
      { range: `> 15 and <= 20`, color: "#21908d" },
      { range: `> 20 and <= 25`, color: "#31688e" },
      { range: `> 25 and <= 30`, color: "#443a82" },
      { range: `> 30`, color: "#440154" }
    ];
  } else if (ScoresLayer) {
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
  
  if (!wasCollapsed && (ScoresLayer || AmenitiesCatchmentLayer || CensusLayer)) {
    dataLayerCategory.classList.remove('legend-category-collapsed');
  }
}

function getAmenityPopupContent(amenityType, properties) {
  // console.log('Getting amenity popup content...');
  let amenityName = 'Unknown';
  let amenityTypeDisplay = 'Unknown';
  let amenityId = properties.COREID || '';
  
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
  
  const showCatchmentButton = `<br><button class="show-catchment-btn" data-amenity-type="${amenityType}" data-amenity-id="${amenityId}">Show Journey Time Catchment</button>`;
  
  return `<strong>Amenity:</strong> ${amenityName} (${amenityTypeDisplay})${showCatchmentButton}`;
}

function findNearbyInfrastructure(latlng, maxPixelDistance = 10, targetLayer = null) {
  // console.log('Finding nearby infrastructure...');
  const results = {
    busStops: [],
    busLines: [],
    features: []
  };

  if (targetLayer) {
    targetLayer.eachLayer(layer => {
      if (layer.getLatLng) {
        const markerPoint = map.latLngToContainerPoint(layer.getLatLng());
        const clickPoint = map.latLngToContainerPoint(latlng);
        const pixelDistance = clickPoint.distanceTo(markerPoint);
        
        if (pixelDistance <= maxPixelDistance) {
          results.features.push({
            layer: layer,
            feature: layer,
            distance: pixelDistance
          });
        }
      }
      else {
        const geojson = layer.toGeoJSON();
        let minPixelDistance = Infinity;
        
        if (geojson.geometry.type === 'LineString') {
          for (let i = 0; i < geojson.geometry.coordinates.length - 1; i++) {
            const p1 = L.latLng(
              geojson.geometry.coordinates[i][1], 
              geojson.geometry.coordinates[i][0]
            );
            const p2 = L.latLng(
              geojson.geometry.coordinates[i+1][1], 
              geojson.geometry.coordinates[i+1][0]
            );
            
            const p1Screen = map.latLngToContainerPoint(p1);
            const p2Screen = map.latLngToContainerPoint(p2);
            
            const distance = distanceToLineSegment(
              map.latLngToContainerPoint(latlng), 
              p1Screen, 
              p2Screen
            );
            
            if (distance < minPixelDistance) {
              minPixelDistance = distance;
            }
          }
        }
        else if (geojson.geometry.type === 'MultiLineString') {
          for (const lineCoords of geojson.geometry.coordinates) {
            for (let i = 0; i < lineCoords.length - 1; i++) {
              const p1 = L.latLng(lineCoords[i][1], lineCoords[i][0]);
              const p2 = L.latLng(lineCoords[i+1][1], lineCoords[i+1][0]);
              
              const p1Screen = map.latLngToContainerPoint(p1);
              const p2Screen = map.latLngToContainerPoint(p2);
              
              const distance = distanceToLineSegment(
                map.latLngToContainerPoint(latlng),
                p1Screen,
                p2Screen
              );
              
              if (distance < minPixelDistance) {
                minPixelDistance = distance;
              }
            }
          }
        }
        else if (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon') {
          const coords = geojson.geometry.coordinates;
          const flattenCoords = coords.flat(geojson.geometry.type === 'MultiPolygon' ? 2 : 1);
          
          for (let ring of flattenCoords) {
            for (let i = 0; i < ring.length - 1; i++) {
              const p1 = L.latLng(ring[i][1], ring[i][0]);
              const p2 = L.latLng(ring[i+1][1], ring[i+1][0]);
              
              const p1Screen = map.latLngToContainerPoint(p1);
              const p2Screen = map.latLngToContainerPoint(p2);
              
              const distance = distanceToLineSegment(
                map.latLngToContainerPoint(latlng),
                p1Screen,
                p2Screen
              );
              
              if (distance < minPixelDistance) {
                minPixelDistance = distance;
              }
            }
          }
        }
        
        if (minPixelDistance <= maxPixelDistance) {
          results.features.push({
            layer: layer,
            feature: layer,
            distance: minPixelDistance
          });
        }
      }
    });
    
    results.features.sort((a, b) => a.distance - b.distance);
    return results;
  }

  if (busStopsLayer) {
    busStopsLayer.eachLayer(layer => {
      const markerPoint = map.latLngToContainerPoint(layer.getLatLng());
      const clickPoint = map.latLngToContainerPoint(latlng);
      const pixelDistance = clickPoint.distanceTo(markerPoint);
      
      if (pixelDistance <= maxPixelDistance) {
        results.busStops.push({
          layer: layer,
          feature: layer.feature,
          distance: pixelDistance
        });
      }
    });
  }
  
  if (busLinesLayer) {
    busLinesLayer.eachLayer(layer => {
      const geojson = layer.toGeoJSON();
      let minPixelDistance = Infinity;
      
      if (geojson.geometry.type === 'LineString') {
        for (let i = 0; i < geojson.geometry.coordinates.length - 1; i++) {
          const p1 = L.latLng(
            geojson.geometry.coordinates[i][1], 
            geojson.geometry.coordinates[i][0]
          );
          const p2 = L.latLng(
            geojson.geometry.coordinates[i+1][1], 
            geojson.geometry.coordinates[i+1][0]
          );
          
          const p1Screen = map.latLngToContainerPoint(p1);
          const p2Screen = map.latLngToContainerPoint(p2);
          
          const distance = distanceToLineSegment(
            map.latLngToContainerPoint(latlng), 
            p1Screen, 
            p2Screen
          );
          
          if (distance < minPixelDistance) {
            minPixelDistance = distance;
          }
        }
      }
      else if (geojson.geometry.type === 'MultiLineString') {
        for (const lineCoords of geojson.geometry.coordinates) {
          for (let i = 0; i < lineCoords.length - 1; i++) {
            const p1 = L.latLng(lineCoords[i][1], lineCoords[i][0]);
            const p2 = L.latLng(lineCoords[i+1][1], lineCoords[i+1][0]);
            
            const p1Screen = map.latLngToContainerPoint(p1);
            const p2Screen = map.latLngToContainerPoint(p2);
            
            const distance = distanceToLineSegment(
              map.latLngToContainerPoint(latlng),
              p1Screen,
              p2Screen
            );
            
            if (distance < minPixelDistance) {
              minPixelDistance = distance;
            }
          }
        }
      }
      
      if (minPixelDistance <= maxPixelDistance) {
        results.busLines.push({
          layer: layer,
          feature: layer.feature,
          distance: minPixelDistance
        });
      }
    });
  }
  
  function distanceToLineSegment(p, v, w) {
    const l2 = distanceSquared(v, w);
    
    if (l2 === 0) return Math.sqrt(distanceSquared(p, v));
    
    const t = Math.max(0, Math.min(1, 
      dotProduct(subtractPoints(p, v), subtractPoints(w, v)) / l2
    ));
    
    const projection = {
      x: v.x + t * (w.x - v.x),
      y: v.y + t * (w.y - v.y)
    };
    
    return Math.sqrt(distanceSquared(p, projection));
  }
  
  function distanceSquared(p1, p2) {
    return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
  }
  
  function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }
  
  function subtractPoints(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
  }
  
  results.busStops.sort((a, b) => {
    const nameA = a.feature.properties.stop_name || '';
    const nameB = b.feature.properties.stop_name || '';
    return nameA.localeCompare(nameB);
  });
  
  results.busLines.sort((a, b) => {
    const serviceA = a.feature.properties.service_name || '';
    const serviceB = b.feature.properties.service_name || '';
    return serviceA.localeCompare(serviceB);
  });
  
  return results;
}

function formatFeatureProperties(feature, featureType) {
  // console.log('Formatting feature properties...');
  if (!feature || !feature.properties) return '<p>No data available</p>';
  
  let html = '<table class="popup-table">';
  html += '<tr><th>Property</th><th>Value</th></tr>';
  
  if (featureType === 'Bus Stop') {
    const props = feature.properties;
    const attributes = [
      { key: 'atco_code', display: 'ATCO Code' },
      { key: 'stop_name', display: 'Stop Name' },
      { key: 'am_peak_combined_frequency', display: 'AM Peak Frequency' },
      { key: 'mode', display: 'Mode' }
    ];
    
    attributes.forEach(attr => {
      const value = props[attr.key];
      if (value !== null && value !== undefined && value !== '') {
        html += `<tr><td>${attr.display}</td><td>${value}</td></tr>`;
      }
    });
  } 
  else if (featureType === 'Bus Line') {
    const props = feature.properties;
    const attributes = [
      { key: 'lines_diva4', display: 'Line ID' },
      { key: 'service_name', display: 'Service Name' },
      { key: 'direction', display: 'Direction' },
      { key: 'am_peak_service_frequency', display: 'AM Peak Frequency' },
      { key: 'operator', display: 'Operator' }
    ];
    
    attributes.forEach(attr => {
      const value = props[attr.key];
      if (value !== null && value !== undefined && value !== '') {
        html += `<tr><td>${attr.display}</td><td>${value}</td></tr>`;
      }
    });
  }
  
  html += '</table>';
  return html;
}

function showInfrastructurePopup(latlng, nearbyFeatures) {
  const busLineFeatures = nearbyFeatures.busLines;
  const busStopFeatures = nearbyFeatures.busStops;
  
  let combinedBusFrequency = 0;
  if (busLineFeatures.length > 0) {
    combinedBusFrequency = busLineFeatures.reduce((total, current) => {
      const frequency = current.feature.properties.am_peak_service_frequency;
      return total + (parseFloat(frequency) || 0);
    }, 0);
  }
  
  const allFeatures = [
    ...busStopFeatures, 
    ...busLineFeatures
  ];
  
  if (allFeatures.length === 0) return;
  
  let currentIndex = 0;
  const totalFeatures = allFeatures.length;
  let popup = null;
  let highlightedLayer = null;
  
  function highlightCurrentFeature() {
    if (highlightedLayer) {
      map.removeLayer(highlightedLayer);
      highlightedLayer = null;
    }
    
    const currentFeature = allFeatures[currentIndex];
    const isStopFeature = busStopFeatures.includes(currentFeature);
    
    if (isStopFeature) {
      highlightedLayer = L.circleMarker(
        currentFeature.layer.getLatLng(), 
        {
          radius: 8,
          color: '#FFFF00',
          weight: 4,
          opacity: 0.8,
          fill: false
        }
      ).addTo(map);
    } else {
      const lineStyle = {
        color: '#FFFF00',
        weight: 6,
        opacity: 0.8
      };
      
      const featureGeoJSON = currentFeature.layer.toGeoJSON();
      highlightedLayer = L.geoJSON(featureGeoJSON, {
        style: lineStyle
      }).addTo(map);
    }
  }
  
  function updatePopupContent() {
    const currentFeature = allFeatures[currentIndex];
    const featureType = busStopFeatures.includes(currentFeature) ? 'Bus Stop' : 'Bus Line';
    
    const template = document.getElementById('infrastructure-popup-template');
    const content = document.importNode(template.content, true);
    
    content.querySelector('[data-field="feature-type"]').textContent = featureType;
    content.querySelector('[data-field="current-index"]').textContent = currentIndex + 1;
    content.querySelector('[data-field="total-features"]').textContent = totalFeatures;
    
    const frequencyContainer = content.querySelector('[data-field="frequency-container"]');
    if (busLineFeatures.length > 0 && featureType === 'Bus Line') {
      frequencyContainer.style.display = 'block';
      content.querySelector('[data-field="combined-frequency"]').textContent = Math.round(combinedBusFrequency);
    }
    
    content.querySelector('[data-field="content"]').innerHTML = formatFeatureProperties(currentFeature.feature, featureType);
    
    const footer = content.querySelector('[data-field="footer"]');
    if (totalFeatures > 1) {
      footer.style.display = 'flex';
      const prevBtn = content.querySelector('[data-field="prev-btn"]');
      const nextBtn = content.querySelector('[data-field="next-btn"]');
      
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === totalFeatures - 1;
    }
    
    const div = document.createElement('div');
    div.appendChild(content);
    popup.setContent(div.innerHTML);
    
    highlightCurrentFeature();
    
    setTimeout(() => {
      const prevBtn = document.getElementById('prev-feature');
      const nextBtn = document.getElementById('next-feature');
      
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (currentIndex > 0) {
            currentIndex--;
            updatePopupContent();
          }
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (currentIndex < totalFeatures - 1) {
            currentIndex++;
            updatePopupContent();
          }
        });
      }
    }, 10);
  }
  
  popup = L.popup({
    autoPan: true,
    closeButton: true,
    closeOnClick: false
  })
    .setLatLng(latlng)
    .setContent('Loading...')
    .openOn(map);
  
  popup.on('remove', function() {
    if (highlightedLayer) {
      map.removeLayer(highlightedLayer);
      highlightedLayer = null;
    }
  });
  
  updatePopupContent();
}

function getAmenityTypeDisplayName(amenityType) {
  // console.log('Getting amenity type display name...');
  switch (amenityType) {
    case 'PriSch': return 'Primary School';
    case 'SecSch': return 'Secondary School';
    case 'FurEd': return 'Further Education';
    case 'Em500': return 'Employment (500+)';
    case 'Em5000': return 'Employment (5000+)';
    case 'StrEmp': return 'Strategic Employment';
    case 'CitCtr': return 'City Centre';
    case 'MajCtr': return 'Major Centre';
    case 'DisCtr': return 'District Centre';
    case 'GP': return 'General Practice';
    case 'Hos': return 'Hospital';
    default: return amenityType;
  }
}

function updateAmenitiesDropdownLabel() {
  // console.log('Updating amenities dropdown label...');
  const amenitiesDropdown = document.getElementById('amenitiesDropdown');
  if (!amenitiesDropdown) return;
  
  if (selectingFromMap) {
    const amenityType = selectedAmenitiesAmenities[0];
    const typeLabel = getAmenityTypeDisplayName(amenityType);
    amenitiesDropdown.textContent = `${typeLabel} (ID: ${selectedAmenitiesFromMap.join(',')})`;
  } else {
    const amenitiesCheckboxesContainer = document.getElementById('amenitiesCheckboxesContainer');
    if (!amenitiesCheckboxesContainer) return;
    
    const amenitiesCheckboxes = amenitiesCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
    const selectedCheckboxes = Array.from(amenitiesCheckboxes).filter(checkbox => checkbox.checked);
    const selectedCount = selectedCheckboxes.length;
  
    if (selectedCount === 0) {
      amenitiesDropdown.textContent = '\u00A0';
    } else if (selectedCount === 1) {
      const nextSibling = selectedCheckboxes[0].nextElementSibling;
      amenitiesDropdown.textContent = nextSibling ? nextSibling.textContent : selectedCheckboxes[0].value;
    } else {
      amenitiesDropdown.textContent = 'Multiple Selection';
    }
  }
}

function updateLayerStyles() {
  if (ScoresLayer && isPanelOpen("Connectivity Scores")) {
    applyScoresLayerStyling();
  } else if (AmenitiesCatchmentLayer && isPanelOpen("Journey Time Catchments - Amenities")) {
    applyAmenitiesCatchmentLayerStyling();
  } else if (CensusLayer && isPanelOpen("Census / Local Plan Data")) {
    applyCensusLayerStyling();
  }
}

function updateScoresLayer() {
  // console.log('Updating scores layer...');
  if (!initialLoadComplete || !isPanelOpen("Connectivity Scores")) {
    return;
  }
  
  const selectedYear = ScoresYear.value;
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;

  if (!selectedYear) {
    updateLegend();
    updateSummaryStatistics([]);
    return;
  }

  const fieldToDisplay = selectedYear.includes('-') ? 
    `${selectedPurpose}_${selectedMode}` : 
    `${selectedPurpose}_${selectedMode}_100`;

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
          updateScoresLayer();
        })
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

  ScoresLayer = L.geoJSON(filteredScoresLayer, {
    pane: 'polygonLayers',
  }).addTo(map);
  ScoresLayer._currentYear = selectedYear;

  applyScoresLayerStyling();
  
  selectedScoresAmenities = purposeToAmenitiesMap[selectedPurpose];
  drawSelectedAmenities(selectedScoresAmenities);
  updateLegend();
  updateFeatureVisibility();
  updateFilterDropdown();
  updateFilterValues();
  updateSummaryStatistics(getCurrentFeatures());
  highlightSelectedArea();
}

function applyScoresLayerStyling() {
  // console.log('applyScoresLayerStyling called');
  if (!ScoresLayer) return;
  
  const selectedYear = ScoresYear.value;
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  const opacityField = ScoresOpacity.value;
  const outlineField = ScoresOutline.value;
  
  const fieldToDisplay = selectedYear.includes('-') ? 
    `${selectedPurpose}_${selectedMode}` : 
    `${selectedPurpose}_${selectedMode}_100`;
    
  let minOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? 
    parseFloat(ScoresOpacityRange.noUiSlider.get()[0]) : 0;
  let maxOpacity = ScoresOpacityRange && ScoresOpacityRange.noUiSlider ? 
    parseFloat(ScoresOpacityRange.noUiSlider.get()[1]) : 0;
  let minOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? 
    parseFloat(ScoresOutlineRange.noUiSlider.get()[0]) : 0;
  let maxOutline = ScoresOutlineRange && ScoresOutlineRange.noUiSlider ? 
    parseFloat(ScoresOutlineRange.noUiSlider.get()[1]) : 0;
  
  ScoresLayer.eachLayer(layer => {
    const style = styleScoresFeature(
      layer.feature, 
      fieldToDisplay, 
      opacityField, 
      outlineField,
      minOpacity, 
      maxOpacity, 
      minOutline, 
      maxOutline, 
      selectedYear
    );

    layer.options._originalStyling = {
      opacity: style.opacity,
      fillOpacity: style.fillOpacity
    };

    layer.setStyle(style);
  });
  
  requestAnimationFrame(() => updateFeatureVisibility());
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

  let opacity;
  if (opacityField === 'None') {
    opacity = layerTransparencyValue; // Use layer transparency directly
  } else {
    const opacityValue = feature.properties[opacityField];
    if (opacityValue === 0 || opacityValue === null || opacityValue === undefined || opacityValue === '') {
      opacity = isInverseScoresOpacity ? 0.5 : 0.1;
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
    fillColor: getColor(parseFloat(value), selectedYear),
    weight: weight,
    opacity: 1,
    color: 'black',
    fillOpacity: opacity
  };
}

function showAmenityCatchment(amenityType, amenityId) {
  // console.log('showAmenityCatchment called');
  const panelHeaders = document.querySelectorAll(".panel-header:not(.summary-header)");
    
  panelHeaders.forEach(header => {
    header.classList.add("collapsed");
    header.nextElementSibling.style.display = "none";
    
    if (header.textContent.includes("Connectivity Scores") && ScoresLayer) {
      map.removeLayer(ScoresLayer);
      ScoresLayer = null;
    } else if (header.textContent.includes("Journey Time Catchments - Amenities") && AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    } else if (header.textContent.includes("Census / Local Plan Data") && CensusLayer) {
      map.removeLayer(CensusLayer);
      CensusLayer = null;
    }
  });
  
  selectingFromMap = true;
  selectedAmenitiesFromMap = [amenityId];
  selectedAmenitiesAmenities = [amenityType];
  
  const amenitiesHeader = Array.from(panelHeaders).find(header => 
    header.textContent.includes("Journey Time Catchments - Amenities"));
  
  if (amenitiesHeader) {
    amenitiesHeader.classList.remove("collapsed");
    amenitiesHeader.nextElementSibling.style.display = "block";
    
    if (!AmenitiesYear.value) {
      AmenitiesYear.value = AmenitiesYear.options[0].value;
    }
    
    if (!AmenitiesMode.value) {
      AmenitiesMode.value = AmenitiesMode.options[0].value;
    }
    
    AmenitiesPurpose.forEach(checkbox => {
      checkbox.checked = false;
    });
    
    const checkbox = Array.from(AmenitiesPurpose).find(checkbox => checkbox.value === amenityType);
    if (checkbox) {
      checkbox.checked = true;
    }
    
    const amenitiesDropdown = document.getElementById('amenitiesDropdown');
    if (amenitiesDropdown) {
      const typeLabel = getAmenityTypeDisplayName(amenityType);
      amenitiesDropdown.textContent = `${typeLabel} (ID: ${amenityId})`;
    }
    
    updateAmenitiesCatchmentLayer();
  }
}

function drawSelectedAmenities(amenities) {
  // console.log('drawSelectedAmenities called');
  const amenitiesCheckbox = document.getElementById('amenitiesCheckbox');
  amenitiesLayerGroup.clearLayers();

  if (!amenitiesCheckbox) {
    return;
  }

  if (amenities.length === 0) {
    selectingFromMap = false;
    selectedAmenitiesFromMap = [];
  }

  const amenitiesToDraw = amenities.length === 0 ? Object.keys(amenityLayers) : amenities;

  const currentZoom = map.getZoom();
  const isAboveZoomThreshold = currentZoom >= 14;

  amenitiesToDraw.forEach(amenity => {
    const amenityLayer = amenityLayers[amenity];
    if (amenityLayer) {
      const layer = L.geoJSON(amenityLayer, {
        pointToLayer: (feature, latlng) => {
          const icon = isAboveZoomThreshold ? 
            amenityIcons[amenity] : 
            L.divIcon({ className: 'fa-icon', html: '<div class="dot"></div>', iconSize: [5, 5], iconAnchor: [5, 5] });
          const marker = L.marker(latlng, { icon: icon });
          marker._amenityType = amenity;
          marker._amenityId = feature.properties.COREID || '';
          
          const isSelectedSpecificAmenity = 
            selectingFromMap && 
            selectedAmenitiesAmenities.includes(amenity) && 
            selectedAmenitiesFromMap.includes(marker._amenityId.toString());
          
          const opacity = isSelectedSpecificAmenity || !selectingFromMap || amenities.length === 0 ? 1 : 0.4;
          
          marker.on('add', function() {
            const element = this.getElement();
            if (element) {
              element.style.opacity = opacity;
            }
          });
          
          marker.on('mouseover', function(e) {
            const element = e.target.getElement();
            if (element) {
              element.style.transform = element.style.transform.replace(/scale\([^)]*\)/, '') + ' scale(1.3)';
              element.style.zIndex = 1000;
              element.style.transition = 'transform 0.2s ease';
              element.style.cursor = 'pointer';
              element.style.opacity = 1;
            }
          });
          
          marker.on('mouseout', function(e) {
            const element = e.target.getElement();
            if (element) {
              element.style.transform = element.style.transform.replace(/scale\([^)]*\)/, '');
              element.style.zIndex = '';
              element.style.opacity = isSelectedSpecificAmenity || !selectingFromMap || amenities.length === 0 ? 1 : 0.4;
            }
          });
          
          marker.on('click', function() {
            const properties = feature.properties;
            const amenityContent = getAmenityPopupContent(marker._amenityType, properties);
            
            const popup = L.popup()
              .setLatLng(latlng)
              .setContent(`<div>${amenityContent}</div>`)
              .openOn(map);
              
            setTimeout(() => {
              const showCatchmentButton = document.querySelector('.show-catchment-btn');
              if (showCatchmentButton) {
                showCatchmentButton.addEventListener('click', function() {
                  const amenityType = this.getAttribute('data-amenity-type');
                  const amenityId = this.getAttribute('data-amenity-id');
                  showAmenityCatchment(amenityType, amenityId);
                  popup.close();
                });
              }
            }, 100);
          });
          
          return marker;
        },
      });
      amenitiesLayerGroup.addLayer(layer);
    }
  });

  if (amenitiesCheckbox.checked) {
    amenitiesLayerGroup.addTo(map);
  }
}

function updateAmenitiesCatchmentLayer() {
  // console.log('updateAmenitiesCatchmentLayer called');
  if (!initialLoadComplete || !isPanelOpen("Journey Time Catchments - Amenities")) {
    return;
  }

  const selectedYear = AmenitiesYear.value;
  const selectedMode = AmenitiesMode.value;
  
  selectedAmenitiesAmenities = Array.from(AmenitiesPurpose)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);
  
  if (ScoresLayer) {
    map.removeLayer(ScoresLayer);
    ScoresLayer = null;
  }

  if (!selectedYear || !selectedMode || selectedAmenitiesAmenities.length === 0) {
    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }
    drawSelectedAmenities([]);
    updateLegend();
    updateFilterDropdown();
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
          
          let matchCount = 0;
          csvData.forEach(row => {
            if (row.Mode === selectedMode) {
              if (selectingFromMap && selectedAmenitiesFromMap.length > 0) {
                let isMatch = false;
                
                const selectedId = selectedAmenitiesFromMap[0];
                
                const rowId = selectedMode === 'PT' ? row.Tracc_ID : row.NA_ID;
                
                if (selectedId === rowId) {
                  isMatch = true;
                }
                else if (!isNaN(parseFloat(rowId)) && !isNaN(parseFloat(selectedId))) {
                  if (parseFloat(selectedId) === parseFloat(rowId)) {
                    isMatch = true;
                  }
                }
                else if (rowId && rowId.includes('.') && 
                         rowId.substring(0, rowId.indexOf('.')) === selectedId) {
                  isMatch = true;
                }
                
                if (isMatch) {
                  if (matchCount < 3) {
                    matchCount++;
                  }
                  const hexId = row.OriginName;
                  const time = parseFloat(row.Time);
                  if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                    hexTimeMap[hexId] = time;
                  }
                }
              } else {
                const hexId = row.OriginName;
                const time = parseFloat(row.Time);
                if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                  hexTimeMap[hexId] = time;
                }
              }
            }
          });
          
          csvDataCache[cacheKey] = csvData;
        });
    } else {
      const csvData = csvDataCache[cacheKey];
      
      let matchCount = 0;
      csvData.forEach(row => {
        if (row.Mode === selectedMode) {
          if (selectingFromMap && selectedAmenitiesFromMap.length > 0) {
            let isMatch = false;
            
            const selectedId = selectedAmenitiesFromMap[0];
            
            const rowId = selectedMode === 'PT' ? row.Tracc_ID : row.NA_ID;
            
            if (selectedId === rowId) {
              isMatch = true;
            }
            else if (!isNaN(parseFloat(rowId)) && !isNaN(parseFloat(selectedId))) {
              if (parseFloat(selectedId) === parseFloat(rowId)) {
                isMatch = true;
              }
            }
            else if (rowId && rowId.includes('.') && 
                     rowId.substring(0, rowId.indexOf('.')) === selectedId) {
              isMatch = true;
            }
            
            if (isMatch) {
              if (matchCount < 3) {
                matchCount++;
              }
              const hexId = row.OriginName;
              const time = parseFloat(row.Time);
              if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                hexTimeMap[hexId] = time;
              }
            }
          } else {
            const hexId = row.OriginName;
            const time = parseFloat(row.Time);
            if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
              hexTimeMap[hexId] = time;
            }
          }
        }
      });
      
      return Promise.resolve();
    }
  });

  Promise.all(fetchPromises).then(() => {    
    hexes.features.forEach(feature => {
      const hexId = feature.properties.Hex_ID;
      if (hexTimeMap[hexId] === undefined) {
        hexTimeMap[hexId] = 120;
      }
    });

    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }

    const filteredFeatures = hexes.features.map(feature => {
      const hexId = feature.properties.Hex_ID;
      const time = hexTimeMap[hexId];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          time: time
        }
      };
    });
    
    const filteredAmenitiesCatchmentLayer = {
      type: "FeatureCollection",
      features: filteredFeatures
    };
    
    AmenitiesCatchmentLayer = L.geoJSON(filteredAmenitiesCatchmentLayer, {
      pane: 'polygonLayers',
    }).addTo(map);
    AmenitiesCatchmentLayer._currentMode = selectedMode;

    applyAmenitiesCatchmentLayerStyling();

    if (selectingFromMap) {
      const selectedAmenityTypes = selectedAmenitiesAmenities;
      drawSelectedAmenities(selectedAmenityTypes);
    } else {
      drawSelectedAmenities(selectedAmenitiesAmenities);
      updateAmenitiesDropdownLabel();
    }

    updateLegend();
    updateFeatureVisibility();
    updateFilterDropdown();
    updateFilterValues();
    updateSummaryStatistics(filteredFeatures);
    highlightSelectedArea();
  });
}

function applyAmenitiesCatchmentLayerStyling() {
  // console.log('applyAmenitiesCatchmentLayerStyling called from:');
  if (!AmenitiesCatchmentLayer) return;

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
      else if (time <= 10) color = '#8fd744';
      else if (time <= 15) color = '#35b779';
      else if (time <= 20) color = '#21908d';
      else if (time <= 25) color = '#31688e';
      else if (time <= 30) color = '#443a82';
      else color = '#440154';
    }

    let opacity;
    if (AmenitiesOpacity.value === 'None') {
      opacity = layerTransparencyValue; // Use layer transparency directly
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
}

function updateCensusLayer() {
  // console.log('updateCensusLayer called from:');
  if (!initialLoadComplete || !isPanelOpen("Census / Local Plan Data")) {
    return;
  }

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

  CensusLayer = L.geoJSON(hexes, {
    pane: 'polygonLayers',
    style: () => {
      return {
        fillColor: baseColorCensus.value,
        weight: 0.5,
        opacity: 1,
        color: 'black',
        fillOpacity: 0.5
      };
    }
  }).addTo(map);

  applyCensusLayerStyling();

  updateLegend();
  updateFilterValues();
  updateSummaryStatistics(hexes.features);
  highlightSelectedArea();
}

function applyCensusLayerStyling() {
  // console.log('applyCensusLayerStyling called from:');
  if (!CensusLayer) return;

  const baseColor = baseColorCensus.value;
  const opacityField = CensusOpacity.value;
  const outlineField = CensusOutline.value;
  
  const minOpacityValue = CensusOpacityRange && CensusOpacityRange.noUiSlider ? 
    parseFloat(CensusOpacityRange.noUiSlider.get()[0]) : 0;
  const maxOpacityValue = CensusOpacityRange && CensusOpacityRange.noUiSlider ? 
    parseFloat(CensusOpacityRange.noUiSlider.get()[1]) : 0;
  const minOutlineValue = CensusOutlineRange && CensusOutlineRange.noUiSlider ? 
    parseFloat(CensusOutlineRange.noUiSlider.get()[0]) : 0;
  const maxOutlineValue = CensusOutlineRange && CensusOutlineRange.noUiSlider ? 
    parseFloat(CensusOutlineRange.noUiSlider.get()[1]) : 0;

  CensusLayer.eachLayer(layer => {
    const feature = layer.feature;
    
    let opacity;
    if (opacityField === 'None') {
      opacity = layerTransparencyValue; // Use layer transparency directly
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

    layer.setStyle({
      fillColor: baseColor,
      weight: weight,
      opacity: 1,
      color: 'black',
      fillOpacity: opacity
    });
  });
}

function updateFilterDropdown() {
  if (isUpdatingFilters) return;
  // console.log('updateFilterDropdown called from:');
  isUpdatingFilters = true;
  const filterTypeDropdown = document.getElementById('filterTypeDropdown');
  if (!filterTypeDropdown) {
    isUpdatingFilters = false;
    return;
  }
  
  const currentValue = filterTypeDropdown.value;
  
  filterTypeDropdown.innerHTML = '';
  
  const standardOptions = [
    { value: 'LA', text: 'Local Authority' },
    { value: 'Ward', text: 'Ward' },
    { value: 'GrowthZone', text: 'Growth Zone' },
    { value: 'WestLinkZone', text: 'WESTlink Zone' }
  ];
  
  if (ScoresLayer || AmenitiesCatchmentLayer) {
    standardOptions.push({ value: 'Range', text: 'Range (see Legend)' });
  }
  
  standardOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    filterTypeDropdown.appendChild(optionElement);
  });
  
  if (userLayers && userLayers.length > 0) {
    userLayers.forEach(userLayer => {
      const option = document.createElement('option');
      option.value = `UserLayer_${userLayer.id}`;
      option.textContent = `User Layer - ${userLayer.name}`;
      filterTypeDropdown.appendChild(option);
    });
  }
  
  if ((currentValue === 'Range' && !(ScoresLayer || AmenitiesCatchmentLayer)) ||
      !Array.from(filterTypeDropdown.options).some(opt => opt.value === currentValue)) {
    filterTypeDropdown.value = 'LA';
  } else {
    filterTypeDropdown.value = currentValue;
  }
  
  isUpdatingFilters = false;
}

function updateFilterValues() {
  if (isUpdatingFilterValues) return;
  // console.log('updateFilterValues called from:');
  isUpdatingFilterValues = true;

  if (!filterTypeDropdown.value) {
    filterTypeDropdown.value = AmenitiesCatchmentLayer ? 'Range' : 'LA';
  }
  
  const currentFilterType = filterTypeDropdown.value;
  
  let filterValueButton = document.getElementById('filterValueButton');
  const filterValueContainer = document.getElementById('filterValueContainer');
  
  if (filterValueContainer) {
    filterValueContainer.innerHTML = '';
  }
  
  if (!filterValueButton) {
    if (filterValueDropdown && filterValueDropdown.parentNode) {
      const dropdownButton = document.createElement('button');
      dropdownButton.type = 'button';
      dropdownButton.className = 'dropdown-toggle';
      dropdownButton.id = 'filterValueButton';
      dropdownButton.textContent = '';
      dropdownButton.style.minHeight = '28px';
      
      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'dropdown';
      dropdownContainer.style.width = '100%';
      
      const dropdownMenu = document.createElement('div');
      dropdownMenu.className = 'dropdown-menu';
      dropdownMenu.id = 'filterValueContainer';
      dropdownMenu.style.width = '100%';
      dropdownMenu.style.boxSizing = 'border-box';
      
      dropdownContainer.appendChild(dropdownButton);
      dropdownContainer.appendChild(dropdownMenu);
      
      if (filterValueDropdown.parentNode) {
        filterValueDropdown.parentNode.replaceChild(dropdownContainer, filterValueDropdown);
      }
      
      dropdownButton.addEventListener('click', () => {
        dropdownMenu.classList.toggle('show');
      });
      
      window.addEventListener('click', (event) => {
        if (!event.target.matches('#filterValueButton') && !event.target.closest('#filterValueContainer')) {
          dropdownMenu.classList.remove('show');
        }
      });
    }
  }

  filterValueButton = document.getElementById('filterValueButton');

  if (!filterValueContainer) {
    isUpdatingFilterValues = false;
    return;
  }
  
  filterValueContainer.innerHTML = '';

  let options = [];
  let filterFieldSelector = null;

  if (currentFilterType.startsWith('UserLayer_')) {
    const layerId = currentFilterType.split('UserLayer_')[1];
    const userLayer = userLayers.find(l => l.id === layerId);
    
    if (userLayer) {
      const fieldSelectorDiv = document.createElement('div');
      fieldSelectorDiv.className = 'filter-field-selector';
      fieldSelectorDiv.style.marginBottom = '10px';
      
      const fieldLabel = document.createElement('label');
      fieldLabel.textContent = 'Filter by field:';
      fieldLabel.style.display = 'block';
      fieldLabel.style.marginBottom = '5px';
      fieldSelectorDiv.appendChild(fieldLabel);
      
      filterFieldSelector = document.createElement('select');
      filterFieldSelector.id = 'user-layer-field-selector';
      filterFieldSelector.className = 'small-font';
      filterFieldSelector.style.width = '100%';
      
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'All features';
      filterFieldSelector.appendChild(defaultOption);
      
      userLayer.fieldNames.forEach(fieldName => {
        const option = document.createElement('option');
        option.value = fieldName;
        option.textContent = fieldName;
        filterFieldSelector.appendChild(option);
      });
      
      if (previousFilterSelections[`UserLayer_${layerId}_field`]) {
        filterFieldSelector.value = previousFilterSelections[`UserLayer_${layerId}_field`];
      }
      
      fieldSelectorDiv.appendChild(filterFieldSelector);
      filterValueContainer.appendChild(fieldSelectorDiv);
      
      filterFieldSelector.addEventListener('change', function() {
        previousFilterSelections[`UserLayer_${layerId}_field`] = this.value;
        populateUserLayerFilterValues(userLayer, this.value);
        if (document.getElementById('highlightAreaCheckbox').checked) {
          highlightSelectedArea();
        }
      });
      
      populateUserLayerFilterValues(userLayer, filterFieldSelector.value);
      isUpdatingFilterValues = false;
      return;
    }
  } else if (currentFilterType === 'Range') {
    const selectedYear = ScoresLayer ? ScoresYear.value : AmenitiesYear.value;
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
    const wardNames = new Set();
    if (wardBoundariesLayer) {
      wardBoundariesLayer.getLayers().forEach(layer => {
        const wardName = layer.feature.properties.WD24NM;
        wardNames.add(wardName);
      });
      options = Array.from(wardNames).sort();
    }
  } else if (currentFilterType === 'GrowthZone') {
    if (GrowthZonesLayer) {
      options = GrowthZonesLayer.getLayers().map(layer => layer.feature.properties.Name).sort();
    }
  } else if (currentFilterType === 'WestLinkZone') {
    if (WestLinkZonesLayer) {
      options = WestLinkZonesLayer.getLayers().map(layer => layer.feature.properties.Name).sort();
    }
  } else if (currentFilterType === 'LA') {
    options = ['MCA', 'LEP'];
    if (uaBoundariesLayer) {
      const uaOptions = uaBoundariesLayer.getLayers()
        .map(layer => layer.feature.properties.LAD24NM)
        .sort();
      options = options.concat(uaOptions);
    }
  }

  const selectAllLabel = document.createElement('label');
  selectAllLabel.className = 'checkbox-label';
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.id = 'select-all-filter';
  selectAllCheckbox.checked = false;
  
  const selectAllSpan = document.createElement('span');
  selectAllSpan.innerHTML = '<i>Select/Deselect All</i>';
  
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(selectAllSpan);
  filterValueContainer.appendChild(selectAllLabel);

  const previouslySelected = previousFilterSelections[currentFilterType] || [];

  const checkboxes = [];
  options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `filter-${option.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
    checkbox.value = option;
    
    checkbox.checked = previouslySelected.length > 0 ? 
      previouslySelected.includes(option) : 
      index === 0;
    
    checkbox.className = 'filter-value-checkbox';
    checkboxes.push(checkbox);
    
    const span = document.createElement('span');
    span.textContent = option;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    filterValueContainer.appendChild(label);
    
    checkbox.addEventListener('change', function() {
      updateStoredSelections();
      updateFilterButtonText();
      updateSummaryStatistics(getCurrentFeatures());
      if (document.getElementById('highlightAreaCheckbox').checked) {
        highlightSelectedArea();
      }
    });
  });
  
  selectAllCheckbox.addEventListener('change', function() {
    const isChecked = this.checked;
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateStoredSelections();
    updateFilterButtonText();
    updateSummaryStatistics(getCurrentFeatures());
    if (document.getElementById('highlightAreaCheckbox').checked) {
      highlightSelectedArea();
    }
  });
  
  function updateStoredSelections() {
    const currentSelections = checkboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    previousFilterSelections[currentFilterType] = currentSelections;
  }
  
  function updateFilterButtonText() {
    const selectedValues = checkboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    if (selectedValues.length === 0) {
      filterValueButton.textContent = '\u00A0';
      filterValueButton.style.minHeight = '28px';
    } else {
      filterValueButton.textContent = selectedValues.join(', ');
    }
  }
  
  const allChecked = checkboxes.every(cb => cb.checked);
  const anyChecked = checkboxes.some(cb => cb.checked);
  selectAllCheckbox.checked = allChecked;
  selectAllCheckbox.indeterminate = anyChecked && !allChecked;
  
  updateFilterButtonText();
  requestAnimationFrame(() => {
    updateSummaryStatistics(getCurrentFeatures());
    isUpdatingFilterValues = false;
  });
}

function updateSummaryStatistics(features) {
  if (isCalculatingStats) return;
  // console.log('updateSummaryStatistics called from:');
  isCalculatingStats = true;
  
  requestAnimationFrame(() => {
    if (!hexes && (!features || features.length === 0)) {
      displayEmptyStatistics();
      isCalculatingStats = false;
      return;
    }
    
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (filterValueContainer) {
      const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
        .map(checkbox => checkbox.value);
      
      if (selectedValues.length === 0) {
        displayEmptyStatistics();
        isCalculatingStats = false;
        return;
      }
    }
    
    const filteredFeatures = applyFilters(features);
    
    if (!filteredFeatures || filteredFeatures.length === 0) {
      displayEmptyStatistics();
      isCalculatingStats = false;
      return;
    }
    
    const stats = calculateStatistics(filteredFeatures);
    updateStatisticsUI(stats);
    isCalculatingStats = false;
  });
}

function displayEmptyStatistics() {
  // console.log('displayEmptyStatistics called from:');
  const statisticIds = [
    'total-population', 'min-population', 'max-population',
    'avg-imd-score', 'min-imd-score', 'max-imd-score',
    'avg-imd-decile', 'min-imd-decile', 'max-imd-decile',
    'avg-car-availability', 'min-car-availability', 'max-car-availability',
    'total-growth-pop', 'min-growth-pop', 'max-growth-pop',
    'avg-score', 'min-score', 'max-score',
    'avg-percentile', 'min-percentile', 'max-percentile',
    'metric-row-1', 'metric-row-2'
  ];
  
  statisticIds.forEach(id => {
    document.getElementById(id).textContent = '-';
  });
  
  const amenityTypes = ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos'];
  amenityTypes.forEach(type => {
    const element = document.getElementById(`count-${type}`);
    if (element) element.textContent = '-';
  });
}

function applyFilters(features) {
  // console.log('applyFilters called from:');
  const filterType = filterTypeDropdown.value;
  
  let filteredFeatures = features && features.length ? features : (hexes ? hexes.features : []);
  
  if ((ScoresLayer || AmenitiesCatchmentLayer) && (!features || features.length === 0)) {
    if (ScoresLayer) {
      filteredFeatures = ScoresLayer.toGeoJSON().features;
    } else if (AmenitiesCatchmentLayer) {
      filteredFeatures = AmenitiesCatchmentLayer.toGeoJSON().features;
    }
  }
  
  if (filterType.startsWith('UserLayer_')) {
    const layerId = filterType.split('UserLayer_')[1];
    const userLayer = userLayers.find(l => l.id === layerId);
    
    if (userLayer) {
      const fieldSelector = document.getElementById('user-layer-field-selector');
      if (fieldSelector && fieldSelector.value) {
        const selectedField = fieldSelector.value;
        const filterCheckboxes = document.querySelectorAll('.filter-value-checkbox:checked');
        const selectedValues = Array.from(filterCheckboxes).map(cb => cb.value);
        
        if (selectedValues.length === 0) return [];
        
        const combinedFeatures = [];
        
        filteredFeatures.forEach(feature => {
          const hexPolygon = turf.polygon(feature.geometry.coordinates);
          
          for (const userFeature of userLayer.originalData.features) {
            if (selectedValues.includes(String(userFeature.properties[selectedField]))) {
              if (userFeature.geometry.type === 'Polygon') {
                const poly = turf.polygon(userFeature.geometry.coordinates);
                const hexCenter = turf.center(hexPolygon);
                if (turf.booleanPointInPolygon(hexCenter, poly)) {
                  combinedFeatures.push(feature);
                  break;
                }
              } 
              else if (userFeature.geometry.type === 'MultiPolygon') {
                const hexCenter = turf.center(hexPolygon);
                const isInside = userFeature.geometry.coordinates.some(coords => {
                  const poly = turf.polygon(coords);
                  return turf.booleanPointInPolygon(hexCenter, poly);
                });
                
                if (isInside) {
                  combinedFeatures.push(feature);
                  break;
                }
              }
              else if (userFeature.geometry.type === 'Point') {
                const point = turf.point(userFeature.geometry.coordinates);
                if (turf.booleanPointInPolygon(point, hexPolygon)) {
                  combinedFeatures.push(feature);
                  break;
                }
              }
              else if (userFeature.geometry.type === 'LineString') {
                const line = turf.lineString(userFeature.geometry.coordinates);
                if (turf.booleanIntersects(line, hexPolygon)) {
                  combinedFeatures.push(feature);
                  break;
                }
              }
              else if (userFeature.geometry.type === 'MultiLineString') {
                const isIntersecting = userFeature.geometry.coordinates.some(coords => {
                  const line = turf.lineString(coords);
                  return turf.booleanIntersects(line, hexPolygon);
                });
                if (isIntersecting) {
                  combinedFeatures.push(feature);
                  break;
                }
              }
            }
          }
        });
        return combinedFeatures;
      } else {
        const userLayerFeatures = userLayer.originalData.features;
        const combinedFeatures = [];
        for (const feature of filteredFeatures) {
          const hexPolygon = turf.polygon(feature.geometry.coordinates);
          for (const userFeature of userLayerFeatures) {
            if (userFeature.geometry.type === 'Polygon') {
              const poly = turf.polygon(userFeature.geometry.coordinates);
              const hexCenter = turf.center(hexPolygon);
              if (turf.booleanPointInPolygon(hexCenter, poly)) {
                combinedFeatures.push(feature);
                break;
              }
            } 
            else if (userFeature.geometry.type === 'MultiPolygon') {
              const hexCenter = turf.center(hexPolygon);
              const isInside = userFeature.geometry.coordinates.some(coords => {
                const poly = turf.polygon(coords);
                return turf.booleanPointInPolygon(hexCenter, poly);
              });
              if (isInside) {
                combinedFeatures.push(feature);
                break;
              }
            }
            else if (userFeature.geometry.type === 'Point') {
              const point = turf.point(userFeature.geometry.coordinates);
              if (turf.booleanPointInPolygon(point, hexPolygon)) {
                combinedFeatures.push(feature);
                break;
              }
            }
            else if (userFeature.geometry.type === 'LineString') {
              const line = turf.lineString(userFeature.geometry.coordinates);
              if (turf.booleanIntersects(line, hexPolygon)) {
                combinedFeatures.push(feature);
                break;
              }
            }
            else if (userFeature.geometry.type === 'MultiLineString') {
              const isIntersecting = userFeature.geometry.coordinates.some(coords => {
                const line = turf.lineString(coords);
                return turf.booleanIntersects(line, hexPolygon);
              });
              
              if (isIntersecting) {
                combinedFeatures.push(feature);
                break;
              }
            }
          }
        }
        return combinedFeatures;
      }
    }
  }
  else if (filterType === 'Range') {
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (!filterValueContainer) return filteredFeatures;
    
    const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedValues.length === 0) return [];
    
    const combinedFeatures = [];
    selectedValues.forEach(filterValue => {
      const rangeFiltered = applyRangeFilter(filteredFeatures, filterValue);
      rangeFiltered.forEach(feature => {
        if (!combinedFeatures.includes(feature)) {
          combinedFeatures.push(feature);
        }
      });
    });
    
    filteredFeatures = combinedFeatures;
  } 
  else if (['Ward', 'GrowthZone', 'WestLinkZone', 'LA'].includes(filterType)) {
    const filterValueContainer = document.getElementById('filterValueContainer');
    if (!filterValueContainer) return filteredFeatures;
    
    const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
      .map(checkbox => checkbox.value);
    
    if (selectedValues.length === 0) return [];
    
    const combinedFeatures = [];
    selectedValues.forEach(filterValue => {
      const geographicFiltered = applyGeographicFilter(filteredFeatures, filterType, filterValue);
      geographicFiltered.forEach(feature => {
        if (!combinedFeatures.some(f => f.properties.Hex_ID === feature.properties.Hex_ID)) {
          combinedFeatures.push(feature);
        }
      });
    });
    
    filteredFeatures = combinedFeatures;
  }
  
  return filteredFeatures;
}

function applyRangeFilter(features, filterValue) {
  // console.log('applyRangeFilter called from:');
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

function adjustSpecialHexCenters(feature) {
  if (feature.properties && feature.properties.Hex_ID === 'NS00493') {
    feature._originalGeometry = JSON.parse(JSON.stringify(feature.geometry));
    
    const shiftedCenter = turf.center(turf.polygon(feature.geometry.coordinates));
    shiftedCenter.geometry.coordinates[0] += 0.001;
    
    feature.properties._adjustedCenter = shiftedCenter.geometry.coordinates;
    
    return feature;
  }
  return feature;
}

function applyGeographicFilter(features, filterType, filterValue) {
  // console.log('applyGeographicFilter called from:');
  const getPolygonForFilter = () => {
    let polygon = null;

    if (filterType.startsWith('UserLayer_')) {
      const layerId = filterType.split('UserLayer_')[1];
      const userLayer = userLayers.find(l => l.id === layerId);
      
      if (userLayer) {
        const fieldSelector = document.getElementById('user-layer-field-selector');
        if (fieldSelector && fieldSelector.value) {
          const selectedField = fieldSelector.value;
          
          const matchingFeatures = userLayer.originalData.features.filter(feature => 
            feature.properties[selectedField] === filterValue
          );
          
          polygon = matchingFeatures.reduce((acc, feature) => {
            const poly = {
              type: 'Feature',
              geometry: feature.geometry,
              properties: feature.properties
            };
            return acc ? turf.union(acc, poly) : poly;
          }, null);
        } else {
          polygon = userLayer.originalData.features.reduce((acc, feature) => {
            const poly = {
              type: 'Feature',
              geometry: feature.geometry,
              properties: feature.properties
            };
            return acc ? turf.union(acc, poly) : poly;
          }, null);
        }
      }
    } else if (filterType === 'Ward') {
      if (!wardBoundariesLayer) return null;

      const wardLayers = wardBoundariesLayer.getLayers().filter(layer =>
        layer.feature.properties.WD24NM === filterValue
      );

      polygon = wardLayers.reduce((acc, layer) => {
        const poly = layer.toGeoJSON();
        return acc ? turf.union(acc, poly) : poly;
      }, null);
    } else if (filterType === 'GrowthZone') {
      if (!GrowthZonesLayer) return null;

      const growthZoneLayer = GrowthZonesLayer.getLayers().find(layer =>
        layer.feature.properties.Name === filterValue
      );
      polygon = growthZoneLayer?.toGeoJSON();
    } else if (filterType === 'WestLinkZone') {
      if (!WestLinkZonesLayer) return null;

      const WestLinkZoneLayer = WestLinkZonesLayer.getLayers().find(layer =>
        layer.feature.properties.Name === filterValue
      );
      polygon = WestLinkZoneLayer?.toGeoJSON();
    } else if (filterType === 'LA') {
      if (!uaBoundariesLayer) return null;

      if (filterValue === 'MCA') {
        const mcaLayers = uaBoundariesLayer.getLayers().filter(layer =>
          layer.feature.properties.LAD24NM !== 'North Somerset'
        );
        polygon = mcaLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } else if (filterValue === 'LEP') {
        const lepLayers = uaBoundariesLayer.getLayers();
        polygon = lepLayers.reduce((acc, layer) => {
          const poly = layer.toGeoJSON();
          return acc ? turf.union(acc, poly) : poly;
        }, null);
      } else {
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
    
    let centerPoint;
    if (feature.properties && feature.properties.Hex_ID === 'NS00493' && feature.properties._adjustedCenter) {
      centerPoint = turf.point(feature.properties._adjustedCenter);
    } else {
      centerPoint = turf.center(hexPolygon);
    }
    
    return turf.booleanPointInPolygon(centerPoint, polygon);
  });
}

function calculateStatistics(features) {
  // console.log('calculateStatistics called from:');
  const baseStats = calculateBaseStatistics(features);
  
  let layerStats = {};
  
  if (ScoresLayer) {
    layerStats = calculateScoreStatistics(features);
  } else if (AmenitiesCatchmentLayer) {
    layerStats = calculateTimeStatistics(features);
  }
  
  const amenityCounts = countAmenitiesByType(features);
  
  return {...baseStats, ...layerStats, amenityCounts};
}

function calculateBaseStatistics(features) {
  // console.log('calculateBaseStatistics called from:');
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
  // console.log('calculateScoreStatistics called from:');
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
  // console.log('calculateTimeStatistics called from:');
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

function countAmenitiesByType(filteredHexagons) {
  const amenityCounts = {
    'PriSch': 0,
    'SecSch': 0,
    'FurEd': 0,
    'Em500': 0,
    'Em5000': 0,
    'StrEmp': 0,
    'CitCtr': 0,
    'MajCtr': 0,
    'DisCtr': 0,
    'GP': 0,
    'Hos': 0
  };

  const filteredHexIds = new Set();
  filteredHexagons.forEach(feature => {
    const hexId = feature.properties.Hex_ID;
    if (hexId) {
      filteredHexIds.add(hexId);
    }
  });

  Object.keys(amenityLayers).forEach(amenityType => {
    if (amenityLayers[amenityType] && amenityLayers[amenityType].features) {
      amenityLayers[amenityType].features.forEach(feature => {
        const hexId = feature.properties.Hex_ID;
        if (hexId && filteredHexIds.has(hexId)) {
          amenityCounts[amenityType]++;
        }
      });
    }
  });

  return amenityCounts;
}

function updateStatisticsUI(stats) {
  document.getElementById('total-population').textContent = formatValue(stats.totalPopulation, 10);
  document.getElementById('min-population').textContent = formatValue(stats.minPopulation, 10);
  document.getElementById('max-population').textContent = formatValue(stats.maxPopulation, 10);
  document.getElementById('avg-imd-score').textContent = formatValue(stats.avgImdScore, 0.1);
  document.getElementById('min-imd-score').textContent = formatValue(stats.minImdScore, 0.1);
  document.getElementById('max-imd-score').textContent = formatValue(stats.maxImdScore, 0.1);
  document.getElementById('avg-imd-decile').textContent = formatValue(stats.avgImdDecile, 1);
  document.getElementById('min-imd-decile').textContent = formatValue(stats.minImdDecile, 1);
  document.getElementById('max-imd-decile').textContent = formatValue(stats.maxImdDecile, 1);
  document.getElementById('avg-car-availability').textContent = formatValue(stats.avgCarAvailability, 0.01);
  document.getElementById('min-car-availability').textContent = formatValue(stats.minCarAvailability, 0.01);
  document.getElementById('max-car-availability').textContent = formatValue(stats.maxCarAvailability, 0.01);
  document.getElementById('total-growth-pop').textContent = formatValue(stats.totalgrowthpop, 10);
  document.getElementById('min-growth-pop').textContent = formatValue(stats.mingrowthpop, 10);
  document.getElementById('max-growth-pop').textContent = formatValue(stats.maxgrowthpop, 10);

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
  
  if (stats.amenityCounts) {
    Object.keys(stats.amenityCounts).forEach(amenityType => {
      const countElement = document.getElementById(`count-${amenityType}`);
      if (countElement) {
        countElement.textContent = stats.amenityCounts[amenityType];
      }
    });
  } else {
    const amenityTypes = ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos'];
    amenityTypes.forEach(type => {
      const element = document.getElementById(`count-${type}`);
      if (element) element.textContent = '-';
    });
  }
}

function filterByScoreDifference(features, fieldToDisplay, filterValue) {
  // console.log('filterByScoreDifference called from:');
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
  // console.log('filterByPercentileRange called from:');
  const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
  return features.filter(feature => {
    const value = feature.properties[fieldToDisplay];
    return value >= minRange && (maxRange ? value <= maxRange : true);
  });
}

function filterByJourneyTime(features, filterValue) {
  // console.log('filterByJourneyTime called from:');
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
  // console.log('getCurrentFeatures called from:');
  const filterType = filterTypeDropdown.value;
  
  let sourceFeatures = [];
  if (ScoresLayer) {
    sourceFeatures = ScoresLayer.toGeoJSON().features;
  } else if (AmenitiesCatchmentLayer) {
    sourceFeatures = AmenitiesCatchmentLayer.toGeoJSON().features;
  } else if (hexes) {
    sourceFeatures = hexes.features;
  }
  
  if (filterType.startsWith('UserLayer_')) {
    const layerId = filterType.split('UserLayer_')[1];
    const userLayer = userLayers.find(l => l.id === layerId);
    
    if (userLayer) {
      return applyFilters(sourceFeatures);
    }
  } 
  
  return sourceFeatures;
}

function highlightSelectedArea() {
  // console.log('highlightSelectedArea called from:');
  const highlightAreaCheckbox = document.getElementById('highlightAreaCheckbox');
  if (!highlightAreaCheckbox.checked) {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    return;
  }
  const filterType = filterTypeDropdown.value;
  
  const filterValueContainer = document.getElementById('filterValueContainer');
  if (!filterValueContainer) return;
  
  const selectedValues = Array.from(filterValueContainer.querySelectorAll('.filter-value-checkbox:checked'))
    .map(checkbox => checkbox.value);
  
  if (selectedValues.length === 0) {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
      highlightLayer = null;
    }
    return;
  }

  let selectedPolygons = [];

  if (filterType.startsWith('UserLayer_')) {
    const layerId = filterType.split('UserLayer_')[1];
    const userLayer = userLayers.find(l => l.id === layerId);
    
    if (userLayer) {
      const fieldSelector = document.getElementById('user-layer-field-selector');
      if (fieldSelector && fieldSelector.value) {
        const selectedField = fieldSelector.value;
        
        const matchingFeatures = userLayer.originalData.features.filter(feature => 
          selectedValues.includes(String(feature.properties[selectedField]))
        );
        
        selectedPolygons = matchingFeatures.map(feature => {
          return {
            type: 'Feature',
            geometry: feature.geometry,
            properties: feature.properties
          };
        });
      } else {
        selectedPolygons = userLayer.originalData.features.map(feature => {
          return {
            type: 'Feature',
            geometry: feature.geometry,
            properties: feature.properties
          };
        });
      }
    }
  } else if (filterType === 'Ward') {
    if (!wardBoundariesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const wardLayers = wardBoundariesLayer.getLayers().filter(layer => layer.feature.properties.WD24NM === filterValue);
      selectedPolygons = [...selectedPolygons, ...wardLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'GrowthZone') {
    if (!GrowthZonesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const growthZoneLayers = GrowthZonesLayer.getLayers().filter(layer => layer.feature.properties.Name === filterValue);
      selectedPolygons = [...selectedPolygons, ...growthZoneLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'WestLinkZone') {
    if (!WestLinkZonesLayer) return;
    
    selectedValues.forEach(filterValue => {
      const WestLinkZoneLayers = WestLinkZonesLayer.getLayers().filter(layer => layer.feature.properties.Name === filterValue);
      selectedPolygons = [...selectedPolygons, ...WestLinkZoneLayers.map(layer => layer.toGeoJSON())];
    });
  } else if (filterType === 'LA') {
    if (!uaBoundariesLayer) return;
    
    selectedValues.forEach(filterValue => {
      if (filterValue === 'MCA') {
        const mcaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM !== 'North Somerset');
        selectedPolygons = [...selectedPolygons, ...mcaLayers.map(layer => layer.toGeoJSON())];
      } else if (filterValue === 'LEP') {
        const lepLayers = uaBoundariesLayer.getLayers();
        selectedPolygons = [...selectedPolygons, ...lepLayers.map(layer => layer.toGeoJSON())];
      } else {
        const uaLayers = uaBoundariesLayer.getLayers().filter(layer => layer.feature.properties.LAD24NM === filterValue);
        selectedPolygons = [...selectedPolygons, ...uaLayers.map(layer => layer.toGeoJSON())];
      }
    });
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
