// ============================================================================
// WEST OF ENGLAND CONNECTIVITY TOOL - MAIN APPLICATION
// ============================================================================

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

// ============================================================================
// WEST OF ENGLAND CONNECTIVITY TOOL - MAIN APPLICATION
// ============================================================================

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

const map = L.map('map').setView([51.480, -2.591], 11);

const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors & CartoDB, © Crown copyright and database rights 2025 OS 0100059651, Contains OS data © Crown copyright [and database right] 2025.',
  pane: 'tilePane'
}).addTo(map);

const LabelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png', {
  opacity: 0.6,
  pane: 'tooltipPane'
}).addTo(map);

// ============================================================================
// ROAD NETWORK MANAGEMENT
// ============================================================================

let osmRoadLayer = null;
let simplifiedRoadLayer = null;
let isLoadingRoads = false;
let lastLoadedBounds = null;
let lastLoadedZoom = null;
let loadRoadsTimeout = null;
let simplifiedNetworkData = null;
let usingFallbackNetwork = false;

/**
 * Load road centerlines from OpenStreetMap Overpass API
 * Displays as white lines - the "road lace" effect
 * Note: Motorway, A roads (primary), and B roads (secondary) are always shown from simplified network
 * This function only loads additional road types at higher zoom levels
 */
async function loadOSMRoadSurfaces() {
  if (isLoadingRoads) return;
  
  const currentZoom = map.getZoom();
  const bounds = map.getBounds();
  
  // First, ensure simplified network (Motorway/A/B roads) is always loaded
  loadSimplifiedNetwork();
  
  // At lower zoom levels, we don't need any additional roads from API
  if (currentZoom < 15) {
    // Remove OSM layer if it exists since we only need simplified network
    if (osmRoadLayer) {
      map.removeLayer(osmRoadLayer);
      osmRoadLayer = null;
    }
    isLoadingRoads = false;
    return;
  }
  
  // Don't reload if we haven't moved much or changed zoom
  if (lastLoadedBounds && lastLoadedZoom === currentZoom) {
    const lastCenter = lastLoadedBounds.getCenter();
    const currentCenter = bounds.getCenter();
    const distance = lastCenter.distanceTo(currentCenter);
    const viewportSize = Math.max(
      bounds.getNorth() - bounds.getSouth(),
      bounds.getEast() - bounds.getWest()
    );
    
    // Only reload if moved more than 20% of viewport
    if (distance < viewportSize * 111000 * 0.2) {
      return;
    }
  }
  
  isLoadingRoads = true;
  
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  
  // Store current view for comparison
  lastLoadedBounds = bounds;
  lastLoadedZoom = currentZoom;
  
  // Build query based on zoom level - only for additional road types
  // Motorway, primary (A roads), and secondary (B roads) are always from simplified network
  let roadTypes;
  if (currentZoom < 17) {
    // Zoom 15-16: add tertiary roads only
    roadTypes = '["highway"~"tertiary"]';
  } else {
    // Zoom 17+: add tertiary, unclassified, and residential
    roadTypes = '["highway"~"tertiary|unclassified|residential"]';
  }
  
  // Overpass QL query for road centerlines
  const query = `
    [out:json][timeout:25];
    (
      way${roadTypes}(${bbox});
    );
    out geom;
  `;
  
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  
  try {
    console.log(`Fetching roads at zoom ${currentZoom}...`);
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: query,
      signal: AbortSignal.timeout(20000) // 20 second timeout
    });
    
    if (!response.ok) {
      if (response.status === 504 || response.status === 429) {
        console.warn('Overpass API busy, loading simplified network fallback');
        loadSimplifiedNetwork();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Loaded ${data.elements.length} road features`);
    
    // Convert OSM data to GeoJSON LineStrings
    const geojson = osmToGeoJSON(data, currentZoom);
    
    // Remove existing layer
    if (osmRoadLayer) {
      map.removeLayer(osmRoadLayer);
    }
    
    // Create new layer with white styling
    osmRoadLayer = L.geoJSON(geojson, {
      pane: 'roadLayers',
      style: function(feature) {
        const highway = feature.properties.highway;
        
        // Real-world widths in meters for different road types
        let roadWidthMeters;
        if (highway === 'motorway') roadWidthMeters = 12.5;
        else if (highway === 'trunk') roadWidthMeters = 10;
        else if (highway === 'primary') roadWidthMeters = 8;
        else if (highway === 'secondary') roadWidthMeters = 6;
        else if (highway === 'tertiary') roadWidthMeters = 5;
        else roadWidthMeters = 4; // residential/unclassified
        
        // Calculate meters per pixel at current zoom and latitude
        // Leaflet uses Web Mercator projection
        const latitude = map.getCenter().lat;
        const metersPerPixel = 40075016.686 * Math.abs(Math.cos(latitude * Math.PI / 180)) / Math.pow(2, currentZoom + 8);
        
        // Calculate pixel width needed to represent the real-world road width
        let weight = roadWidthMeters / metersPerPixel;
        
        // Ensure minimum visibility at all zoom levels
        const minWeight = 1.5; // minimum pixel width
        weight = Math.max(weight, minWeight);
        
        return {
          color: '#ffffff',
          weight: weight,
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round'
        };
      }
    }).addTo(map);
    
    console.log('Roads added to map');
    
  } catch (error) {
    if (error.name === 'TimeoutError' || error.message.includes('504')) {
      console.warn('Road loading timed out, loading simplified network fallback');
      loadSimplifiedNetwork();
    } else {
      console.error('Error loading roads:', error);
      loadSimplifiedNetwork();
    }
  } finally {
    isLoadingRoads = false;
  }
}

/**
 * Load simplified network for Motorway, A roads, and B roads
 * This is always loaded and shown, not just as a fallback
 */
function loadSimplifiedNetwork() {
  if (simplifiedRoadLayer) return; // Already loaded and displayed
  
  if (simplifiedNetworkData) {
    // Data already loaded, just display it
    displaySimplifiedNetwork();
    return;
  }
  
  // Load the simplified network GeoJSON
  const networkFile = InfrastructureFiles.find(file => file.type === 'RoadNetwork');
  if (!networkFile) {
    console.error('Simplified network file not found');
    return;
  }
  
  fetch(networkFile.path)
    .then(response => response.json())
    .then(data => {
      simplifiedNetworkData = data;
      displaySimplifiedNetwork();
    })
    .catch(error => {
      console.error('Error loading simplified network:', error);
    });
}

/**
 * Display the simplified network with OSM-style white roads
 * Shows Motorway, A roads (primary), and B roads (secondary)
 */
function displaySimplifiedNetwork() {
  if (!simplifiedNetworkData) return;
  if (simplifiedRoadLayer) return; // Already displayed
    
  let filteredCount = 0;
  
  // Create layer with same styling as OSM roads for major roads only
  simplifiedRoadLayer = L.geoJSON(simplifiedNetworkData, {
    pane: 'roadLayers',
    filter: function(feature) {
      // Only show Motorway, A roads, and B roads
      const roadClass = feature.properties.roadclassification || feature.properties.highway || feature.properties.type || '';
      const shouldShow = roadClass === 'Motorway' || roadClass === 'A Road' || roadClass === 'B Road';
      if (shouldShow) filteredCount++;
      return shouldShow;
    },
    style: function(feature) {
      const roadClass = feature.properties.roadclassification || feature.properties.highway || feature.properties.type || '';
      const currentZoom = map.getZoom();
      
      // Real-world widths in meters for different road types
      let roadWidthMeters;
      if (roadClass === 'Motorway') roadWidthMeters = 12.5;
      else if (roadClass === 'A Road') roadWidthMeters = 10;
      else if (roadClass === 'B Road') roadWidthMeters = 6;
      else roadWidthMeters = 4;
      
      const latitude = map.getCenter().lat;
      const metersPerPixel = 40075016.686 * Math.abs(Math.cos(latitude * Math.PI / 180)) / Math.pow(2, currentZoom + 8);
      let weight = roadWidthMeters / metersPerPixel;
      
      const minWeight = 1.5;
      weight = Math.max(weight, minWeight);
      
      return {
        color: '#ffffff',
        weight: weight,
        opacity: 1,
        lineJoin: 'round',
        lineCap: 'round'
      };
    }
  }).addTo(map);
}

/**
 * Update simplified road styling based on current zoom level
 */
function updateSimplifiedRoadStyling() {
  if (!simplifiedRoadLayer) return;
  
  const currentZoom = map.getZoom();
  const latitude = map.getCenter().lat;
  const metersPerPixel = 40075016.686 * Math.abs(Math.cos(latitude * Math.PI / 180)) / Math.pow(2, currentZoom + 8);
  
  simplifiedRoadLayer.eachLayer(function(layer) {
    const feature = layer.feature;
    const roadClass = feature.properties.roadclassification || feature.properties.highway || feature.properties.type || '';
    
    // Real-world widths in meters for different road types
    let roadWidthMeters;
    if (roadClass === 'Motorway') roadWidthMeters = 20;
    else if (roadClass === 'A Road') roadWidthMeters = 12;
    else if (roadClass === 'B Road') roadWidthMeters = 8;
    else roadWidthMeters = 6;
    
    // Calculate pixel width
    let weight = roadWidthMeters / metersPerPixel;
    const minWeight = 1.5;
    weight = Math.max(weight, minWeight);
    
    // Update the layer style
    layer.setStyle({
      weight: weight
    });
  });
}

/**
 * Convert OSM JSON to GeoJSON (LineStrings for roads)
 */
function osmToGeoJSON(osmData, zoom) {
  const features = [];
  
  osmData.elements.forEach(element => {
    if (element.type === 'way' && element.geometry) {
      const coordinates = element.geometry.map(node => [node.lon, node.lat]);
      
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        },
        properties: element.tags || {}
      });
    }
  });
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

// ============================================================================
// GEOGRAPHY & BOUNDARY DATA
// ============================================================================

// ============================================================================
// GEOGRAPHY & BOUNDARY DATA (LAs, Wards, LSOAs, Growth Zones)
// ============================================================================

let lsoaLookup = {};
let wardLookup = {};
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
    
    // Fetch ward to LAD lookup data
    return fetch(`https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LSOA21_WD24_LAD24_EW_LU/FeatureServer/0/query?outFields=WD24CD,WD24NM,LAD24CD,LAD24NM&where=LAD24CD%20IN%20(${ladCodesString})&f=geojson`)
      .then(lookupResponse => lookupResponse.json())
      .then(lookupData => {
        // Build ward lookup: WD24CD -> {WD24NM, LAD24NM}
        lookupData.features.forEach(feature => {
          const wardCode = feature.properties.WD24CD;
          const wardName = feature.properties.WD24NM;
          const ladName = feature.properties.LAD24NM;
          if (!wardLookup[wardCode]) {
            wardLookup[wardCode] = { WD24NM: wardName, LAD24NM: ladName };
          }
        });
        
        // Enrich ward features with LAD24NM
        filteredFeatures.forEach(feature => {
          const wardCode = feature.properties.WD24CD;
          if (wardLookup[wardCode]) {
            feature.properties.LAD24NM = wardLookup[wardCode].LAD24NM;
          }
        });
        
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
        
        updateFilterValues();
      });
  })

fetch(`https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LSOA21_WD24_LAD24_EW_LU/FeatureServer/0/query?outFields=*&where=LAD24CD%20IN%20(${ladCodesString})&f=geojson`)
  .then(response => response.json())
  .then(data => {
    data.features.forEach(feature => {
      const lsoaCode = feature.properties.LSOA21CD;
      const wardCode = feature.properties.WD24CD;
      lsoaLookup[lsoaCode] = true;
      
      // Also build ward lookup if not already present
      if (wardCode && !wardLookup[wardCode]) {
        wardLookup[wardCode] = {
          WD24NM: feature.properties.WD24NM,
          LAD24NM: feature.properties.LAD24NM
        };
      }
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

// ============================================================================
// UI CONTROLS & DOM ELEMENTS
// ============================================================================

// ============================================================================
// UI CONTROLS & DOM ELEMENT REFERENCES
// ============================================================================

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
  PriSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  SecSch: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-school amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  FurEd: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-university amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em500: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Em5000: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  StrEmp: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-briefcase amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  CitCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-city amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  MajCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-shopping-bag amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  DisCtr: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-store amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  GP: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-stethoscope amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] }),
  Hos: L.divIcon({ className: 'fa-icon', html: '<div class="pin"><i class="fas fa-hospital amenity-icon-pin"></i></div>', iconSize: [60, 60], iconAnchor: [15, 15] })
};
const filterTypeDropdown = document.getElementById('filterTypeDropdown');
const filterValueDropdown = document.getElementById('filterValueDropdown');

GeographyFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(data => {
      if (file.type === 'Hexes') {
        const convertedData = convertMultiPolygonToPolygons(data);
        convertedData.features = convertedData.features.map(adjustSpecialHexCenters);
        hexes = convertedData;
        if (initialLoadComplete) {
          updateSummaryStatistics(hexes.features);
        }
      } else if (file.type === 'GrowthZones') {
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
      }
    });
});

AmenitiesFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(amenityLayer => {
      amenityLayers[file.type] = amenityLayer;
      drawSelectedAmenities([]);
    });
});

InfrastructureFiles.forEach(file => {
  fetch(file.path)
    .then(response => response.json())
    .then(data => {
      if (file.type === 'BusLines') {
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
      } else if (file.type === 'BusStops') {
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
      } else if (file.type === 'WestLink') {
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
      } else if (file.type === 'RoadNetwork') {
        roadNetworkLayer = L.geoJSON(data, {
          pane: 'roadLayers',
          style: {
            color: '#666',
            weight: 1,
            opacity: 0.6
          }
        });
        // Don't add to map by default - controlled by checkbox
      }
    });
});

ScoresYear.value = "";
ScoresOpacity.value = "None";
ScoresOutline.value = "None";
AmenitiesOpacity.value = "None";
AmenitiesOutline.value = "None";
CensusOpacity.value = "None";
CensusOutline.value = "None";

// ============================================================================
// LAYER STATE & CONFIGURATION
// ===========================================================================default=

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
let layerTransparencyValue = 0.5;
let layerTransparencyUpdateTimeout;

function throttledUpdateLayerTransparency() {
  clearTimeout(layerTransparencyUpdateTimeout);
  layerTransparencyUpdateTimeout = setTimeout(updateLayerTransparency, 50);
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

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize all range sliders
[ScoresOpacityRange, ScoresOutlineRange, AmenitiesOpacityRange, 
 AmenitiesOutlineRange, CensusOpacityRange, CensusOutlineRange].forEach(initializeSliders);

setTimeout(() => {
  if (!initializeLayerTransparencySliderAmenities()) {
    setTimeout(initializeLayerTransparencySliderAmenities, 1000);
  }
}, 100);

setTimeout(() => {
  if (!initializeLayerTransparencySliderScores()) {
    setTimeout(initializeLayerTransparencySliderScores, 1000);
  }
}, 100);

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// ============================================================================
// EVENT LISTENERS
// ============================================================================

ScoresYear.addEventListener("change", () => {
  updatePurposeOptions();
  updateScoresLayer();
});
ScoresPurpose.addEventListener("change", () => updateScoresLayer());

function updatePurposeOptions() {
  const selectedYear = ScoresYear.value;
  const isDftYear = selectedYear === '2024 (DfT)';
  const currentPurpose = ScoresPurpose.value;
  
  // Get all purpose options
  const standardPurposes = document.querySelectorAll('#purposeScoresDropdown .standard-purpose');
  const dftPurposes = document.querySelectorAll('#purposeScoresDropdown .dft-purpose');
  const hstOption = document.querySelector('#purposeScoresDropdown option[value="HSt"]');
  
  if (isDftYear) {
    // Hide High Street, show DfT purposes
    if (hstOption) hstOption.classList.add('hidden');
    dftPurposes.forEach(opt => opt.classList.remove('hidden'));
    
    // If current selection is High Street, switch to All
    if (currentPurpose === 'HSt') {
      ScoresPurpose.value = 'All';
    }
  } else {
    // Show High Street, hide DfT purposes
    if (hstOption) hstOption.classList.remove('hidden');
    dftPurposes.forEach(opt => opt.classList.add('hidden'));
    
    // If current selection is a DfT-only purpose, switch to All
    if (['Lei', 'Shp', 'Res'].includes(currentPurpose)) {
      ScoresPurpose.value = 'All';
    }
  }
}
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

// Consolidated layer control event listeners
const layerControls = [
  { type: 'Scores', opacity: ScoresOpacity, outline: ScoresOutline, inverseOpacity: ScoresInverseOpacity, inverseOutline: ScoresInverseOutline, layer: () => ScoresLayer, apply: applyScoresLayerStyling },
  { type: 'Amenities', opacity: AmenitiesOpacity, outline: AmenitiesOutline, inverseOpacity: AmenitiesInverseOpacity, inverseOutline: AmenitiesInverseOutline, layer: () => AmenitiesCatchmentLayer, apply: applyAmenitiesCatchmentLayerStyling },
  { type: 'Census', opacity: CensusOpacity, outline: CensusOutline, inverseOpacity: CensusInverseOpacity, inverseOutline: CensusInverseOutline, layer: () => CensusLayer, apply: applyCensusLayerStyling }
];

layerControls.forEach(control => {
  control.opacity.addEventListener("change", () => {
    updateSliderRanges(control.type, 'Opacity');
    if (control.type === 'Scores' || control.type === 'Amenities') {
      setTransparencySliderState(control.type);
    }
    if (control.layer()) control.apply();
  });
  control.outline.addEventListener("change", () => {
    updateSliderRanges(control.type, 'Outline');
    if (control.layer()) control.apply();
  });
  control.inverseOpacity.addEventListener("click", () => {
    toggleInverseScale(control.type, 'Opacity');
    if (control.layer()) control.apply();
  });
  control.inverseOutline.addEventListener("click", () => {
    toggleInverseScale(control.type, 'Outline');
    if (control.layer()) control.apply();
  });
});

baseColorCensus.addEventListener("change", () => {
  if (CensusLayer) applyCensusLayerStyling();
  else updateCensusLayer();
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
          loadOSMRoadSurfaces();
        } else {
          if (osmRoadLayer) {
            map.removeLayer(osmRoadLayer);
            osmRoadLayer = null;
          }
          if (simplifiedRoadLayer) {
            map.removeLayer(simplifiedRoadLayer);
            simplifiedRoadLayer = null;
          }
        }
      });
    }

    // Reload road surfaces when map moves (panning/zooming) - if checkbox is checked
    // Use debouncing to prevent too many API calls
    map.on('moveend', function() {
      if (roadNetworkCheckbox && roadNetworkCheckbox.checked) {
        // Clear any pending load
        if (loadRoadsTimeout) {
          clearTimeout(loadRoadsTimeout);
        }
        // Wait 1500ms (1.5 seconds) after movement stops before loading
        loadRoadsTimeout = setTimeout(() => {
          loadOSMRoadSurfaces();
        }, 1500);
      }
    });

    // Auto-load road surfaces on startup
    if (roadNetworkCheckbox) {
      roadNetworkCheckbox.checked = true;
      loadOSMRoadSurfaces();
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
  initializeFileUpload();
  initializeLayerStorage();
  setupAmenitiesToggle();

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
    
    map.getPane('tilePane').style.zIndex = 200;
    
    map.createPane('polygonLayers').style.zIndex = 300;
    map.createPane('boundaryLayers').style.zIndex = 400;
    map.createPane('busLayers').style.zIndex = 500;
    map.createPane('roadLayers').style.zIndex = 600;
    map.createPane('userLayers').style.zIndex = 700;
  }
  
  setupMapPanes();
});

map.on('zoomend', () => {
  const currentZoom = map.getZoom();
  const isAboveZoomThreshold = currentZoom >= 14;
  
  // Update simplified road styling on zoom
  updateSimplifiedRoadStyling();
  
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
    Boundaries: [],
    Hexagon: []
  };

  if (uaBoundariesLayer) {
    uaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Boundaries.push(`<strong>Local Authority:</strong> ${layer.feature.properties.LAD24NM}`);
      }
    });
  }

  if (wardBoundariesLayer) {
    wardBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        const wardName = layer.feature.properties.WD24NM;
        const ladName = layer.feature.properties.LAD24NM;
        popupContent.Boundaries.push(`<strong>WD24NM:</strong> ${wardName}`);
        if (ladName) {
          popupContent.Boundaries.push(`<strong>LAD24NM:</strong> ${ladName}`);
        }
      }
    });
  }

  if (lsoaBoundariesLayer) {
    lsoaBoundariesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Boundaries.push(`<strong>LSOA:</strong> ${layer.feature.properties.LSOA21NM}`);
      }
    });
  }

  if (GrowthZonesLayer) {
    GrowthZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Boundaries.push(`<strong>Growth Zone:</strong> ${layer.feature.properties.Name}`);
      }
    });
  }

  if (WestLinkZonesLayer) {
    WestLinkZonesLayer.eachLayer(layer => {
      const polygon = turf.polygon(layer.feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(clickedPoint, polygon)) {
        popupContent.Boundaries.push(`<strong>WESTlink Zone:</strong> ${layer.feature.properties.Name}`);
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
          
          let scoreField, percentileField;
          if (selectedYear === '2024 (DfT)') {
            scoreField = `dft_${selectedPurpose}_${selectedMode}`;
            percentileField = `dft_${selectedPurpose}_${selectedMode}_100`;
          } else if (selectedYear.includes('-')) {
            scoreField = `${selectedPurpose}_${selectedMode}`;
            percentileField = null; // No percentile for difference years
          } else {
            scoreField = `${selectedPurpose}_${selectedMode}`;
            percentileField = `${selectedPurpose}_${selectedMode}_100`;
          }

          const scoreValue = properties[scoreField];
          const score = selectedYear.includes('-')
            ? `${(scoreValue * 100).toFixed(1)}%` 
            : formatValue(scoreValue, 1);
          const percentile = percentileField ? formatValue(properties[percentileField], 1) : '-';
          const population = formatValue(properties.pop, 10);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.imd_decile_mhclg, 1);
          const carAvailability = formatValue(properties.hh_caravail_ts045, 0.01);
          const growthPop = formatValue(properties.pop_growth, 10);
          const scoreLabel = selectedYear.includes('-') ? 'Score Difference' : 'Score';

          popupContent.Hexagon.push(`
            <strong>Hex_ID:</strong> ${properties.hex_id}<br>
            <strong>${scoreLabel}:</strong> ${score}<br>
            <strong>Percentile:</strong> ${percentile}<br>
            <strong>Population:</strong> ${population}<br>
            <strong>IMD Decile:</strong> ${imdDecile}<br>
            <strong>Car Availability:</strong> ${carAvailability}<br>
            <strong>Population Growth:</strong> ${growthPop}
          `);
        } else if (AmenitiesCatchmentLayer) {
          const time = formatValue(hexTimeMap[properties.hex_id], 1);
          const population = formatValue(properties.pop, 10);
          const imdScore = formatValue(properties.IMDScore, 0.1);
          const imdDecile = formatValue(properties.imd_decile_mhclg, 1);
          const carAvailability = formatValue(properties.hh_caravail_ts045, 0.01);
          const growthPop = formatValue(properties.pop_growth, 10);

          popupContent.Hexagon.push(`
            <strong>Hex_ID:</strong> ${properties.hex_id}<br>
            <strong>Journey Time:</strong> ${time} minutes<br>
            <strong>Population:</strong> ${population}<br>
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
        const imdDecile = formatValue(properties.imd_decile_mhclg, 1);
        const carAvailability = formatValue(properties.hh_caravail_ts045, 0.01);
        const growthPop = formatValue(properties.pop_growth, 10);

        popupContent.Hexagon.push(`
          <strong>Hex_ID:</strong> ${properties.hex_id}<br>
          <strong>Population:</strong> ${population}<br>
          <strong>IMD Decile:</strong> ${imdDecile}<br>
          <strong>Car Availability:</strong> ${carAvailability}<br>
          <strong>Population Growth:</strong> ${growthPop}
        `);
      }
    });
  }

  const content = `
    <div>
      <h4 style="text-decoration: underline;">Boundaries</h4>
      ${popupContent.Boundaries.length > 0 ? popupContent.Boundaries.join('<br>') : '-'}
      <h4 style="text-decoration: underline;">Hexagon</h4>
      ${popupContent.Hexagon.length > 0 ? popupContent.Hexagon.join('<br>') : '-'}
    </div>
  `;

  L.popup()
    .setLatLng(clickedLatLng)
    .setContent(content)
    .openOn(map);
});

// ============================================================================
// USER LAYERS & FILE UPLOAD
// ============================================================================

// ============================================================================
// USER LAYERS & FILE UPLOAD MANAGEMENT
// ============================================================================

function initializeFileUpload() {
  const fileInput = document.getElementById('fileUpload');
  const uploadFromFileBtn = document.getElementById('uploadFromFileBtn');
  
  if (!fileInput || !uploadFromFileBtn) return;
  
  // Trigger file input when button is clicked
  uploadFromFileBtn.addEventListener('click', function() {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', function() {
    const file = this.files[0];
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
    
    // Reset the input so the same file can be uploaded again if needed
    fileInput.value = '';
  });
}

function initializeLayerStorage() {
  const loadLayersBtn = document.getElementById('loadLayersBtn');
  
  if (loadLayersBtn) {
    loadLayersBtn.addEventListener('click', function() {
      showLoadLayerDialog();
    });
  }
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
      
      const layerNameSpan = layerControl.querySelector('.layer-name');
      layerNameSpan.textContent = layerName.length > 15 ? layerName.substring(0, 15) + '...' : layerName;
      layerNameSpan.title = layerName;
      
      layerControl.setAttribute('data-id', layerId);
      
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
      
      // Prevent checkbox from triggering context menu on itself
      checkbox.addEventListener('contextmenu', function(e) {
        e.stopPropagation();
      });
      
      // Context menu on right-click
      layerControl.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const layerId = this.getAttribute('data-id');
        showLayerContextMenu(e, layerId);
      });
      
      // Also add context menu to layer name for easier access
      layerNameSpan.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const layerId = layerControl.getAttribute('data-id');
        showLayerContextMenu(e, layerId);
      });
      
      // Drag and drop functionality
      setupLayerDragDrop(layerControl, layerId);
      
      try {
        map.fitBounds(layer.getBounds());
      } catch (e) {
        // console.error("Error zooming to layer bounds:", e);
      }
      
      updateFilterDropdown();
    }
    
    drawFeatureGroup.clearLayers();
    
    return layer;
  } catch (error) {
    alert('Error adding layer: ' + error.message);
    // console.error("Error details:", error);
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
    drawingNameInput.classList.add('disabled-input');
  }
  
  const instructions = document.getElementById('drawing-instructions');
  if (instructions) {
    instructions.textContent = 'Editing mode: Click on features to edit or delete them. Use drawing tools to add new features. Press ESC to cancel.';
    instructions.style.display = 'block';
  }
  
  map.getContainer().classList.add('cursor-pointer');
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
  
  const point = map.latLngToContainerPoint(latlng);
  contextMenu.style.left = `${point.x}px`;
  contextMenu.style.top = `${point.y}px`;
  
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit Attributes';
  
  const styleButton = document.createElement('button');
  styleButton.textContent = 'Style Feature';
  
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete Feature';
  deleteButton.classList.add('delete-btn');
  
  const addHoverEffect = (button) => {
    button.addEventListener('mouseover', () => {
      button.classList.add('hover');
    });
    button.addEventListener('mouseout', () => {
      button.classList.remove('hover');
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

function applyLayerStyle(checkboxId, layer, color, weight, opacity, fillColor, fillOpacity) {
  if (!layer) return;
  
  const style = {
    color: color,
    weight: weight,
    opacity: opacity,
    fillColor: fillColor,
    fillOpacity: fillOpacity
  };
  
  // Special handling for different layer types
  if (checkboxId === 'busStopsCheckbox') {
    // Bus stops are circle markers
    layer.eachLayer(l => {
      l.setStyle({
        color: color,
        fillColor: fillColor,
        weight: weight,
        opacity: opacity,
        fillOpacity: l.options._calculatedFillOpacity * fillOpacity
      });
    });
  } else if (checkboxId === 'busLinesCheckbox') {
    // Bus lines have calculated opacity based on frequency
    layer.eachLayer(l => {
      l.setStyle({
        color: color,
        weight: weight,
        opacity: l.options._calculatedOpacity * opacity
      });
    });
  } else if (checkboxId === 'roadNetworkCheckbox') {
    // Road network - apply to both layers
    if (osmRoadLayer) {
      osmRoadLayer.setStyle({
        color: color,
        weight: weight,
        opacity: opacity
      });
    }
    if (simplifiedRoadLayer) {
      simplifiedRoadLayer.setStyle({
        color: color,
        weight: weight,
        opacity: opacity
      });
    }
  } else if (layer.setStyle) {
    // Standard layer with setStyle method
    layer.setStyle(style);
  } else if (layer.getLayers) {
    // Layer group - apply to all sublayers
    layer.eachLayer(l => {
      if (l.setStyle) {
        l.setStyle(style);
      }
    });
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
// ============================================================================
// DRAWING TOOLS (Points, Lines, Polygons)
// ============================================================================

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
          // console.log("Detected likely British National Grid coordinates:", coord);
          return 'EPSG:27700';
        }
        else if (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90) {
          // console.log("Detected likely Web Mercator coordinates:", coord);
          return 'EPSG:3857';
        }
      }
    }
    return false;
  };
  
  const projectionType = checkSampleCoordinates();
  
  if (projectionType) {
    // console.log(`Reprojecting from ${projectionType} to WGS84`);
    
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

function renameUserLayer(layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  const newName = prompt('Enter new name for layer:', userLayer.name);
  if (newName && newName.trim() !== '' && newName !== userLayer.name) {
    userLayer.name = newName.trim();
    
    // Update the layer name in the UI
    const layerElement = document.querySelector(`.user-layer-item[data-id="${layerId}"]`);
    if (layerElement) {
      const layerNameSpan = layerElement.querySelector('.layer-name');
      if (layerNameSpan) {
        layerNameSpan.textContent = userLayer.name;
      }
    }
    
    // Update filter dropdown if this layer is selected
    updateFilterDropdown();
  }
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
    
    const layerElement = document.querySelector(`.user-layer-item[data-id="${layerId}"]`);
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

// ============================================================================
// LOCAL STORAGE FOR USER LAYERS
// ============================================================================

function saveUserLayerToLocalStorage(layerId) {
  try {
    const userLayer = userLayers.find(l => l.id === layerId);
    if (!userLayer) {
      alert('Layer not found.');
      return false;
    }
    
    const layerData = {
      name: userLayer.name,
      fileName: userLayer.fileName,
      defaultColor: userLayer.defaultColor,
      strokeOpacity: userLayer.strokeOpacity,
      weight: userLayer.weight,
      fillColor: userLayer.fillColor,
      fillOpacity: userLayer.fillOpacity,
      labelField: userLayer.labelField,
      labelColor: userLayer.labelColor,
      labelOpacity: userLayer.labelOpacity,
      labelSize: userLayer.labelSize,
      originalData: userLayer.originalData,
      timestamp: new Date().toISOString()
    };
    
    // Get existing saved layers
    const savedLayersObj = JSON.parse(localStorage.getItem('taf_saved_layers') || '{}');
    
    // Generate unique key for this layer
    const storageKey = `${userLayer.name}_${Date.now()}`;
    savedLayersObj[storageKey] = layerData;
    
    localStorage.setItem('taf_saved_layers', JSON.stringify(savedLayersObj));
    
    alert(`Layer "${userLayer.name}" saved to browser storage.`);
    return true;
  } catch (error) {
    console.error('Error saving layer to local storage:', error);
    if (error.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Try exporting the layer as a file instead.');
    } else {
      alert('Error saving layer: ' + error.message);
    }
    return false;
  }
}

function showLoadLayerDialog() {
  try {
    const savedLayersObj = JSON.parse(localStorage.getItem('taf_saved_layers') || '{}');
    const savedLayerKeys = Object.keys(savedLayersObj);
    
    if (savedLayerKeys.length === 0) {
      alert('No saved layers found in browser storage.');
      return;
    }
    
    // Create dialog
    const existingDialog = document.getElementById('load-layer-dialog');
    if (existingDialog) {
      document.body.removeChild(existingDialog);
    }
    
    const dialog = document.createElement('div');
    dialog.id = 'load-layer-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 500px;
      max-height: 70vh;
      overflow-y: auto;
      min-width: 350px;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #007bff;">Load Saved Layer</h3>
      <div style="margin-bottom: 15px; color: #666; font-size: 0.9em;">
        Select a layer to load from browser storage:
      </div>
      <div id="saved-layers-list" style="margin-bottom: 15px;"></div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
        <button id="cancel-load-btn" class="btn" style="background-color: #6c757d;">Cancel</button>
      </div>
    `;
    
    const layersList = dialog.querySelector('#saved-layers-list');
    
    // Sort by timestamp (newest first)
    savedLayerKeys.sort((a, b) => {
      const timeA = new Date(savedLayersObj[a].timestamp).getTime();
      const timeB = new Date(savedLayersObj[b].timestamp).getTime();
      return timeB - timeA;
    });
    
    savedLayerKeys.forEach(key => {
      const layerData = savedLayersObj[key];
      const layerItem = document.createElement('div');
      layerItem.style.cssText = `
        padding: 12px;
        margin-bottom: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      layerItem.onmouseover = function() {
        this.style.backgroundColor = '#f0f8ff';
        this.style.borderColor = '#007bff';
      };
      layerItem.onmouseout = function() {
        this.style.backgroundColor = 'white';
        this.style.borderColor = '#ddd';
      };
      
      const timestamp = new Date(layerData.timestamp);
      const timeStr = timestamp.toLocaleString();
      
      layerItem.innerHTML = `
        <div>
          <div style="font-weight: bold; margin-bottom: 4px;">${layerData.name}</div>
          <div style="font-size: 0.85em; color: #666;">Saved: ${timeStr}</div>
        </div>
        <div style="display: flex; gap: 5px;">
          <button class="load-layer-btn" data-key="${key}" style="padding: 5px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Load
          </button>
          <button class="delete-saved-layer-btn" data-key="${key}" style="padding: 5px 12px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Delete
          </button>
        </div>
      `;
      
      layersList.appendChild(layerItem);
    });
    
    // Add event listeners for load buttons
    dialog.querySelectorAll('.load-layer-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const key = this.getAttribute('data-key');
        loadUserLayerFromStorage(key);
        document.body.removeChild(dialog);
      });
    });
    
    // Add event listeners for delete buttons
    dialog.querySelectorAll('.delete-saved-layer-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const key = this.getAttribute('data-key');
        const layerData = savedLayersObj[key];
        if (confirm(`Delete saved layer "${layerData.name}"?`)) {
          delete savedLayersObj[key];
          localStorage.setItem('taf_saved_layers', JSON.stringify(savedLayersObj));
          document.body.removeChild(dialog);
          showLoadLayerDialog(); // Refresh the dialog
        }
      });
    });
    
    dialog.querySelector('#cancel-load-btn').addEventListener('click', function() {
      document.body.removeChild(dialog);
    });
    
    document.body.appendChild(dialog);
    
  } catch (error) {
    console.error('Error showing load dialog:', error);
    alert('Error accessing saved layers: ' + error.message);
  }
}

function loadUserLayerFromStorage(storageKey) {
  try {
    const savedLayersObj = JSON.parse(localStorage.getItem('taf_saved_layers') || '{}');
    const savedLayer = savedLayersObj[storageKey];
    
    if (!savedLayer) {
      alert('Saved layer not found.');
      return false;
    }
    
    // Add the layer
    addUserLayer(savedLayer.originalData, savedLayer.fileName);
    
    // Apply saved styles
    const newLayer = userLayers[userLayers.length - 1];
    if (newLayer) {
      newLayer.defaultColor = savedLayer.defaultColor;
      newLayer.strokeOpacity = savedLayer.strokeOpacity;
      newLayer.weight = savedLayer.weight;
      newLayer.fillColor = savedLayer.fillColor;
      newLayer.fillOpacity = savedLayer.fillOpacity;
      newLayer.labelField = savedLayer.labelField;
      newLayer.labelColor = savedLayer.labelColor;
      newLayer.labelOpacity = savedLayer.labelOpacity;
      newLayer.labelSize = savedLayer.labelSize;
      applyUserLayerStyle(newLayer.id);
    }
    
    alert(`Layer "${savedLayer.name}" loaded successfully.`);
    return true;
  } catch (error) {
    console.error('Error loading layer from storage:', error);
    alert('Error loading layer: ' + error.message);
    return false;
  }
}

function exportUserLayers() {
  if (userLayers.length === 0) {
    alert('No layers to export.');
    return;
  }
  
  try {
    const layersToExport = userLayers.map(layer => ({
      name: layer.name,
      fileName: layer.fileName,
      defaultColor: layer.defaultColor,
      strokeOpacity: layer.strokeOpacity,
      weight: layer.weight,
      fillColor: layer.fillColor,
      fillOpacity: layer.fillOpacity,
      labelField: layer.labelField,
      labelColor: layer.labelColor,
      labelOpacity: layer.labelOpacity,
      labelSize: layer.labelSize,
      originalData: layer.originalData
    }));
    
    const dataStr = JSON.stringify(layersToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TAF_layers_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting layers:', error);
    alert('Error exporting layers: ' + error.message);
  }
}

function showLayerContextMenu(event, layerId) {
  // Remove existing context menu if any
  const existingMenu = document.getElementById('layer-context-menu');
  if (existingMenu) {
    document.body.removeChild(existingMenu);
  }
  
  const menu = document.createElement('div');
  menu.id = 'layer-context-menu';
  menu.className = 'layer-context-menu';
  
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  menu.innerHTML = `
    <div class="layer-context-menu-item" data-action="rename">
      <i class="fas fa-i-cursor"></i>
      <span>Rename Layer</span>
    </div>
    <div class="layer-context-menu-divider"></div>
    <div class="layer-context-menu-item" data-action="save">
      <i class="fas fa-save"></i>
      <span>Save to Library</span>
    </div>
    <div class="layer-context-menu-item" data-action="export">
      <i class="fas fa-download"></i>
      <span>Export Layer</span>
    </div>
    <div class="layer-context-menu-divider"></div>
    <div class="layer-context-menu-item" data-action="style">
      <i class="fas fa-palette"></i>
      <span>Style Layer</span>
    </div>
    <div class="layer-context-menu-item" data-action="edit">
      <i class="fas fa-edit"></i>
      <span>Edit Layer</span>
    </div>
    <div class="layer-context-menu-item" data-action="zoom">
      <i class="fas fa-search-plus"></i>
      <span>Zoom to Layer</span>
    </div>
    <div class="layer-context-menu-divider"></div>
    <div class="layer-context-menu-item" data-action="remove">
      <i class="fas fa-trash"></i>
      <span>Remove Layer</span>
    </div>
  `;
  
  // Position menu and prevent overflow
  document.body.appendChild(menu);
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = event.clientX;
  let top = event.clientY;
  
  // Prevent horizontal overflow
  if (left + menuRect.width > viewportWidth) {
    left = viewportWidth - menuRect.width - 5;
  }
  
  // Prevent vertical overflow
  if (top + menuRect.height > viewportHeight) {
    top = viewportHeight - menuRect.height - 5;
  }
  
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  
  // Add click handlers for menu items
  menu.querySelectorAll('.layer-context-menu-item').forEach(item => {
    item.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      handleLayerContextAction(action, layerId);
      document.body.removeChild(menu);
    });
  });
  
  // Close menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      const menuElement = document.getElementById('layer-context-menu');
      if (menuElement) {
        document.body.removeChild(menuElement);
      }
      document.removeEventListener('click', closeMenu);
    });
  }, 100);
}

function handleLayerContextAction(action, layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  switch(action) {
    case 'rename':
      renameUserLayer(layerId);
      break;
    case 'save':
      saveUserLayerToLocalStorage(layerId);
      break;
    case 'export':
      exportSingleLayer(layerId);
      break;
    case 'style':
      openStyleDialog(layerId);
      break;
    case 'edit':
      startEditingLayer(layerId);
      break;
    case 'zoom':
      try {
        if (userLayer.layer) {
          map.fitBounds(userLayer.layer.getBounds());
        }
      } catch (e) {
        console.error("Error zooming to layer bounds:", e);
      }
      break;
    case 'remove':
      removeUserLayer(layerId);
      updateFilterDropdown();
      updateFilterValues();
      break;
  }
}

function exportSingleLayer(layerId) {
  const userLayer = userLayers.find(l => l.id === layerId);
  if (!userLayer) return;
  
  try {
    // Export as GeoJSON format
    const dataStr = JSON.stringify(userLayer.originalData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/geo+json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userLayer.name}_${new Date().toISOString().split('T')[0]}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting layer:', error);
    alert('Error exporting layer: ' + error.message);
  }
}

function setupLayerDragDrop(layerElement, layerId) {
  layerElement.addEventListener('dragstart', function(e) {
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layerId);
  });
  
  layerElement.addEventListener('dragend', function(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.user-layer-item').forEach(item => {
      item.classList.remove('drag-over');
    });
  });
  
  layerElement.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const draggingElement = document.querySelector('.dragging');
    if (draggingElement && draggingElement !== this) {
      this.classList.add('drag-over');
    }
  });
  
  layerElement.addEventListener('dragleave', function(e) {
    this.classList.remove('drag-over');
  });
  
  layerElement.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const draggedLayerId = e.dataTransfer.getData('text/plain');
    const targetLayerId = this.getAttribute('data-id');
    
    if (draggedLayerId !== targetLayerId) {
      reorderUserLayers(draggedLayerId, targetLayerId);
    }
  });
}

function reorderUserLayers(draggedLayerId, targetLayerId) {
  const draggedIndex = userLayers.findIndex(l => l.id === draggedLayerId);
  const targetIndex = userLayers.findIndex(l => l.id === targetLayerId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Reorder the array
  const draggedLayer = userLayers[draggedIndex];
  userLayers.splice(draggedIndex, 1);
  userLayers.splice(targetIndex, 0, draggedLayer);
  
  // Update UI
  const userLayersContainer = document.getElementById('userLayersContainer');
  const layerElements = Array.from(userLayersContainer.querySelectorAll('.user-layer-item'));
  
  // Clear container
  userLayersContainer.innerHTML = '';
  
  // Re-add in new order
  userLayers.forEach(layer => {
    const element = layerElements.find(el => el.getAttribute('data-id') === layer.id);
    if (element) {
      userLayersContainer.appendChild(element);
    }
  });
  
  // Update z-index on map
  updateLayerZIndices();
}

function updateLayerZIndices() {
  // Update z-index based on order in userLayers array
  // Lower index = lower z-index (drawn first, appears below)
  userLayers.forEach((userLayer, index) => {
    if (userLayer.layer && userLayer.layer.setZIndex) {
      userLayer.layer.setZIndex(700 + index);
    } else if (userLayer.layer) {
      // For layers without setZIndex, remove and re-add in order
      const wasVisible = map.hasLayer(userLayer.layer);
      map.removeLayer(userLayer.layer);
      if (wasVisible) {
        map.addLayer(userLayer.layer);
      }
      
      if (userLayer.labelLayerGroup) {
        const wasLabelVisible = map.hasLayer(userLayer.labelLayerGroup);
        map.removeLayer(userLayer.labelLayerGroup);
        if (wasLabelVisible) {
          map.addLayer(userLayer.labelLayerGroup);
        }
      }
    }
  });
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

// ============================================================================
// SLIDER UTILITIES
// ============================================================================

// ============================================================================
// SLIDER UTILITIES
// ============================================================================

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
    const numericValues = field !== "None" ?
      hexesData.features
        .map(feature => Number(feature.properties[field]))
        .filter(val => Number.isFinite(val)) : [];

    const hasValues = numericValues.length > 0;
    const minValue = hasValues ? Math.min(...numericValues) : 0;
    const maxValue = hasValues ? Math.max(...numericValues) : 0;
    const step = hasValues ? chooseStepFromMax(maxValue) : 1;

    if (field === "None" || !hasValues) {
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
      const adjustedMaxValue = Math.ceil(maxValue / step) * step;
      const adjustedMinValue = Math.floor(minValue / step) * step;

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
  if (!LayerTransparencySliderAmenities) {
    return false;
  }

  if (LayerTransparencySliderAmenities.noUiSlider) {
    LayerTransparencySliderAmenities.noUiSlider.destroy();
  }

  try {
    noUiSlider.create(LayerTransparencySliderAmenities, {
      start: [50],
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

    LayerTransparencySliderAmenities.noUiSlider.on('update', function (values) {
      layerTransparencyValue = parseFloat(values[0]) / 100;
      if (LayerTransparencyValueAmenities) {
        LayerTransparencyValueAmenities.textContent = Math.round(values[0]) + '%';
      }
      throttledUpdateLayerTransparency();
    });

    const connectElements = LayerTransparencySliderAmenities.querySelectorAll('.noUi-connect');
    if (connectElements.length > 0) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
    }
    setTransparencySliderState('Amenities');
    return true;
  } catch (error) {
    // console.error('Error initializing layer transparency slider:', error);
    return false;
  }
}

function updateLayerTransparency() {
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
  if (!LayerTransparencySliderScores) {
    return false;
  }
  
  if (LayerTransparencySliderScores.noUiSlider) {
    LayerTransparencySliderScores.noUiSlider.destroy();
  }

  try {
    noUiSlider.create(LayerTransparencySliderScores, {
      start: [50],
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

    LayerTransparencySliderScores.noUiSlider.on('update', function (values) {
      layerTransparencyValue = parseFloat(values[0]) / 100;
      if (LayerTransparencyValueScores) {
        LayerTransparencyValueScores.textContent = Math.round(values[0]) + '%';
      }
      throttledUpdateLayerTransparency();
    });

    const connectElements = LayerTransparencySliderScores.querySelectorAll('.noUi-connect');
    if (connectElements.length > 0) {
      connectElements[0].classList.add('noUi-connect-dark-grey');
    }
    setTransparencySliderState('Scores');
    return true;
  } catch (error) {
    // console.error('Error initializing layer transparency slider for scores:', error);
    return false;
  }
}

function setTransparencySliderState(layerType) {
  const slider = layerType === 'Scores' ? LayerTransparencySliderScores : LayerTransparencySliderAmenities;
  const valueLabel = layerType === 'Scores' ? LayerTransparencyValueScores : LayerTransparencyValueAmenities;
  const opacitySelect = layerType === 'Scores' ? ScoresOpacity : AmenitiesOpacity;
  if (!slider || !opacitySelect || !slider.noUiSlider) return;
  const disabled = opacitySelect.value && opacitySelect.value !== 'None';
  if (disabled) {
    slider.setAttribute('disabled', 'true');
    slider.style.pointerEvents = 'none';
  } else {
    slider.removeAttribute('disabled');
    slider.style.pointerEvents = '';
  }
  slider.classList.toggle('slider-disabled', disabled);
  slider.querySelectorAll('.noUi-handle').forEach(handle => handle.setAttribute('tabindex', disabled ? '-1' : '0'));
  if (valueLabel) valueLabel.style.opacity = disabled ? '0.5' : '1';
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
// ============================================================================
// UTILITY FUNCTIONS (Scaling, Formatting, Visibility)
// ============================================================================

  isUpdatingSliders = false;
}

function scaleExp(value, minVal, maxVal, minScale, maxScale, order) {
  if (value <= minVal) return order === 'low-to-high' ? minScale : maxScale;
  if (value >= maxVal) return order === 'low-to-high' ? maxScale : minScale;
  const normalizedValue = (value - minVal) / (maxVal - minVal);
  const scaledValue = order === 'low-to-high' ? normalizedValue : 1 - normalizedValue;
  return minScale + scaledValue * (maxScale - minScale);
}

// Helper functions to reduce duplication in layer styling
function getSliderRange(sliderElement) {
  return sliderElement && sliderElement.noUiSlider ? [
    parseFloat(sliderElement.noUiSlider.get()[0]),
    parseFloat(sliderElement.noUiSlider.get()[1])
  ] : [0, 0];
}

function calculateOpacity(opacityField, feature, minValue, maxValue, order, isInverse) {
  if (opacityField === 'None') {
    return layerTransparencyValue;
  }
  const opacityValue = feature.properties[opacityField];
  if (opacityValue === 0 || opacityValue === null || opacityValue === undefined || opacityValue === '') {
    return isInverse ? 0.5 : 0.1;
  }
  return scaleExp(opacityValue, minValue, maxValue, 0.1, 0.8, order);
}

function calculateOutline(outlineField, feature, minValue, maxValue, order) {
  if (outlineField === 'None') {
    return 0;
  }
  const outlineValue = feature.properties[outlineField];
  if (outlineValue === 0 || outlineValue === null || outlineValue === undefined || outlineValue === '') {
    return 0;
  }
  return scaleExp(outlineValue, minValue, maxValue, 0, 4, order);
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

function chooseStepFromMax(maxValue) {
  if (maxValue === null || maxValue === undefined || isNaN(maxValue)) return 1;
  if (maxValue > 1000) return 100;
  if (maxValue > 100) return 10;
  if (maxValue >= 10) return 1;
  return 0.1;
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
        const parts = range.split('-');
        // Handle cases like "0-10 - description"
        const firstDash = range.indexOf('-');
        const secondDash = range.indexOf('-', firstDash + 1);
        let rangeString = range;
        if (secondDash > 0 && range.includes(' - ')) {
          rangeString = range.substring(0, range.indexOf(' - '));
        }
        const [min, max] = rangeString.split('-').map(parseFloat);
        if (!isNaN(min) && !isNaN(max) && value >= min && value <= max && !isChecked) {
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
    updateLayerVisibility(AmenitiesCatchmentLayer, feature => hexTimeMap[feature.properties.hex_id], selectedYear, 'time');
  } else if (ScoresLayer) {
    const showPercentiles = window.usePercentileClassification !== false;
    let fieldToDisplay;
    if (selectedYear === '2024 (DfT)') {
      fieldToDisplay = showPercentiles ? `dft_${ScoresPurpose.value}_${ScoresMode.value}_100` : `dft_${ScoresPurpose.value}_${ScoresMode.value}`;
    } else if (selectedYear.includes('-')) {
      fieldToDisplay = `${ScoresPurpose.value}_${ScoresMode.value}`;
    } else {
      fieldToDisplay = showPercentiles ? `${ScoresPurpose.value}_${ScoresMode.value}_100` : `${ScoresPurpose.value}_${ScoresMode.value}`;
    }
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
  
  // Hide legend entirely when no data layer is active
  if (!ScoresLayer && !AmenitiesCatchmentLayer && !CensusLayer) {
    dataLayerCategory.style.display = 'none';
    return;
  } else {
    dataLayerCategory.style.display = '';
  }

  // For Census-only view, keep legend hidden
  if (CensusLayer && !ScoresLayer && !AmenitiesCatchmentLayer) {
    dataLayerCategory.style.display = 'none';
    return;
  }
  
  const legendCategoryHeader = dataLayerCategory.querySelector('.legend-category-header span');
  if (legendCategoryHeader) {
    if (ScoresLayer) {
      legendCategoryHeader.textContent = selectedYear.includes('-') ? "Score Difference" : "Connectivity Scores";
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
    if (selectedYear.includes('-')) {
      // Score difference classes
      classes = [
        { range: `<= -20%`, color: "#FF0000" },
        { range: `> -20% and <= -10%`, color: "#FF5500" },
        { range: `> -10% and < 0`, color: "#FFAA00" },
        { range: `= 0`, color: "transparent" },
        { range: `> 0 and <= 10%`, color: "#B0E200" },
        { range: `>= 10% and < 20%`, color: "#6EC500" },
        { range: `>= 20%`, color: "#38A800" }
      ];
    } else {
      const legendPercentileCheckbox = document.getElementById('legendPercentileCheckbox');
      const isShowingPercentiles = legendPercentileCheckbox ? legendPercentileCheckbox.checked : (window.usePercentileClassification !== false);
      
      if (isShowingPercentiles) {
        classes = [
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
      } else {
        // When percentiles are off, show simple numeric ranges without population text
        classes = [
          { range: `90-100`, color: "#fde725" },
          { range: `80-90`, color: "#b5de2b" },
          { range: `70-80`, color: "#6ece58" },
          { range: `60-70`, color: "#35b779" },
          { range: `50-60`, color: "#1f9e89" },
          { range: `40-50`, color: "#26828e" },
          { range: `30-40`, color: "#31688e" },
          { range: `20-30`, color: "#3e4989" },
          { range: `10-20`, color: "#482777" },
          { range: `0-10`, color: "#440154" }
        ];
      }
    }
  } else if (CensusLayer) {
    // Simple legend entry for census base styling
    classes = [
      { range: 'Census layer', color: baseColorCensus.value }
    ];
  }

  // Add percentile checkbox for Connectivity Scores (non-difference years)
  if (ScoresLayer && !selectedYear.includes('-')) {
    const percentileCheckboxDiv = document.createElement("div");
    
    // Different label for DfT vs non-DfT scores
    let checkboxLabel;
    if (selectedYear === '2024 (DfT)') {
      checkboxLabel = 'Show population-weighted percentiles';
    } else {
      checkboxLabel = 'Show population-weighted percentiles';
    }
    
    percentileCheckboxDiv.innerHTML = `<input type="checkbox" id="legendPercentileCheckbox" ${window.usePercentileClassification !== false ? 'checked' : ''}> <i style="font-size: 1em;">${checkboxLabel}</i>`;
    percentileCheckboxDiv.style.marginBottom = '8px';
    legendContent.appendChild(percentileCheckboxDiv);
    
    const newLegendPercentileCheckbox = document.getElementById('legendPercentileCheckbox');
    newLegendPercentileCheckbox.addEventListener('change', () => {
      window.usePercentileClassification = newLegendPercentileCheckbox.checked;
      updateScoresLayer();
      updateLegend();
    });
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
  const showPercentiles = window.usePercentileClassification !== false;

  if (!selectedYear) {
    updateLegend();
    updateSummaryStatistics([]);
    return;
  }

  let fieldToDisplay;
  let rawFieldForPercentiles = null; // Field to calculate percentiles from (for non-DfT scores)
  
  if (selectedYear.includes('-')) {
    // Difference scores always use base field (no _100 suffix)
    fieldToDisplay = `${selectedPurpose}_${selectedMode}`;
  } else {
    // All single-year scores (DfT and non-DfT): toggle between _100 field and raw field based on checkbox
    const prefix = selectedYear === '2024 (DfT)' ? 'dft_' : ;
    const suffix = showPercentiles ? '_100' : '';
    fieldToDisplay = `${prefix}${selectedPurpose}_${selectedMode}${suffix}`;
    
    // For non-DfT raw scores, track the field for percentile-based classification
    if (!showPercentiles && selectedYear !== '2024 (DfT)') {
      rawFieldForPercentiles = fieldToDisplay;
    }
  }

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
    // Handle both Hex_ID (standard) and hex_id (DfT) column names
    const hexId = row.Hex_ID || row.hex_id;
    if (hexId && row[fieldToDisplay] !== undefined) {
      scoreLookup[hexId] = row;
    }
  });

  if (ScoresLayer) {
    map.removeLayer(ScoresLayer);
    ScoresLayer = null;
  }

  const featuresWithScores = hexes.features
    .filter(feature => scoreLookup[feature.properties.hex_id])
    .map(feature => {
      const hexId = feature.properties.hex_id;
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
  const showPercentiles = window.usePercentileClassification !== false;
  const opacityField = ScoresOpacity.value;
  const outlineField = ScoresOutline.value;
  
  let fieldToDisplay;
  if (selectedYear.includes('-')) {
    // Difference scores always use base field
    fieldToDisplay = `${selectedPurpose}_${selectedMode}`;
  } else {
    // All single-year scores: toggle between _100 and raw field based on checkbox
    const prefix = selectedYear === '2024 (DfT)' ? 'dft_' : ;
    const suffix = showPercentiles ? '_100' : '';
    fieldToDisplay = `${prefix}${selectedPurpose}_${selectedMode}${suffix}`;
  }
    
  const [minOpacity, maxOpacity] = getSliderRange(ScoresOpacityRange);
  const [minOutline, maxOutline] = getSliderRange(ScoresOutlineRange);
  
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
    if (!selectedYear || value === undefined || value === null || value === '') {
      return 'transparent';
    }
  
    if (selectedYear.includes('-')) {
      // Difference scores
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
      // All single-year scores use 0-100 scale classification
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

  const opacity = calculateOpacity(opacityField, feature, minOpacityValue, maxOpacityValue, opacityScoresOrder, isInverseScoresOpacity);
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
      const [year, amenityType] = cacheKey.split('_');
      const csvPath = JourneyTimeFiles.getPath(year, amenityType);
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
                  const hexId = row.hex_id;
                  const time = parseFloat(row.Time);
                  if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                    hexTimeMap[hexId] = time;
                  }
                }
              } else {
                const hexId = row.hex_id;
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
              const hexId = row.hex_id;
              const time = parseFloat(row.Time);
              if (!hexTimeMap[hexId] || time < hexTimeMap[hexId]) {
                hexTimeMap[hexId] = time;
              }
            }
          } else {
            const hexId = row.hex_id;
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
      const hexId = feature.properties.hex_id;
      if (hexTimeMap[hexId] === undefined) {
        hexTimeMap[hexId] = 120;
      }
    });

    if (AmenitiesCatchmentLayer) {
      map.removeLayer(AmenitiesCatchmentLayer);
      AmenitiesCatchmentLayer = null;
    }

    const filteredFeatures = hexes.features.map(feature => {
      const hexId = feature.properties.hex_id;
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

  const [minOpacityValue, maxOpacityValue] = getSliderRange(AmenitiesOpacityRange);
  const [minOutlineValue, maxOutlineValue] = getSliderRange(AmenitiesOutlineRange);
  
  AmenitiesCatchmentLayer.eachLayer(layer => {
    const feature = layer.feature;
    const hexId = feature.properties.hex_id;
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

    const opacity = calculateOpacity(AmenitiesOpacity.value, feature, minOpacityValue, maxOpacityValue, opacityAmenitiesOrder, isInverseAmenitiesOpacity);
    const weight = calculateOutline(AmenitiesOutline.value, feature, minOutlineValue, maxOutlineValue, outlineAmenitiesOrder);

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
  
  const [minOpacityValue, maxOpacityValue] = getSliderRange(CensusOpacityRange);
  const [minOutlineValue, maxOutlineValue] = getSliderRange(CensusOutlineRange);

  CensusLayer.eachLayer(layer => {
    const feature = layer.feature;
    const opacity = calculateOpacity(opacityField, feature, minOpacityValue, maxOpacityValue, opacityCensusOrder, isInverseCensusOpacity);
    const weight = calculateOutline(outlineField, feature, minOutlineValue, maxOutlineValue, outlineCensusOrder);

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
    const wardInfo = new Map();
    if (wardBoundariesLayer) {
      wardBoundariesLayer.getLayers().forEach(layer => {
        const wardName = layer.feature.properties.WD24NM;
        const ladName = layer.feature.properties.LAD24NM || '';
        if (!wardInfo.has(wardName)) {
          wardInfo.set(wardName, ladName);
        }
      });
      options = Array.from(wardInfo.keys()).sort();
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

// ============================================================================
// STATISTICS & SUMMARY CALCULATIONS
// ============================================================================

// ============================================================================
// STATISTICS & SUMMARY CALCULATIONS
// ============================================================================

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
    'avg-imd-decile', 'min-imd-decile', 'max-imd-decile',
    'avg-car-availability', 'min-car-availability', 'max-car-availability',
    'avg-score', 'min-score', 'max-score',
    'avg-percentile', 'min-percentile', 'max-percentile',
    'metric-row-1', 'metric-row-2'
  ];
  
  statisticIds.forEach(id => {
    document.getElementById(id).textContent = '-';
  });

  // Hide score / percentile rows when nothing is selected
  const scoreRow = document.getElementById('avg-score')?.closest('tr');
  const percentileRow = document.getElementById('avg-percentile')?.closest('tr');
  if (scoreRow) scoreRow.style.display = 'none';
  if (percentileRow) percentileRow.style.display = 'none';
  
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
        if (!combinedFeatures.some(f => f.properties.hex_id === feature.properties.hex_id)) {
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
    const showPercentiles = window.usePercentileClassification !== false;
    let fieldToDisplay;
    if (selectedYear === '2024 (DfT)') {
      fieldToDisplay = showPercentiles ? `dft_${ScoresPurpose.value}_${ScoresMode.value}_100` : `dft_${ScoresPurpose.value}_${ScoresMode.value}`;
    } else if (selectedYear.includes('-')) {
      fieldToDisplay = `${ScoresPurpose.value}_${ScoresMode.value}`;
    } else {
      fieldToDisplay = showPercentiles ? `${ScoresPurpose.value}_${ScoresMode.value}_100` : `${ScoresPurpose.value}_${ScoresMode.value}`;
    }
    
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
  if (feature.properties && feature.properties.hex_id === 'NS00493') {
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
    if (feature.properties && feature.properties.hex_id === 'NS00493' && feature.properties._adjustedCenter) {
      centerPoint = turf.point(feature.properties._adjustedCenter);
    } else {
      centerPoint = turf.center(hexPolygon);
    }
    
    return turf.booleanPointInPolygon(centerPoint, polygon);
  });
}

function calculateStatistics(features) {
  // console.log('calculateStatistics called from:');
  // Filter to only include hexagons from the four districts (BA, BS, SG, NS) for statistics
  const fourDistricts = ['BA', 'BS', 'SG', 'NS'];
  const filteredFeatures = features.filter(feature => 
    feature.properties && feature.properties.District && fourDistricts.includes(feature.properties.District)
  );
  
  const baseStats = calculateBaseStatistics(filteredFeatures);
  
  let layerStats = {};
  
  if (ScoresLayer) {
    layerStats = calculateScoreStatistics(filteredFeatures);
  } else if (AmenitiesCatchmentLayer) {
    layerStats = calculateTimeStatistics(filteredFeatures);
  }
  
  const amenityCounts = countAmenitiesByType(filteredFeatures);
  
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
    metrics.imd_decile.push(props.imd_decile_mhclg || 0);
    metrics.carAvailability.push(props.hh_caravail_ts045 || 0);
    metrics.growthpop.push(props.pop_growth || 0);
  });

  const stats = {
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
  
  // Calculate stats for dynamically added metrics
  Object.keys(availableMetrics).forEach(metricKey => {
    const metric = availableMetrics[metricKey];
    const values = [];
    
    features.forEach(feature => {
      const val = feature.properties[metric.dataField] || 0;
      values.push(val);
    });
    
    if (values.length > 0) {
      if (metric.aggregation === 'total') {
        const nonZeroValues = values.filter(v => v > 0);
        stats[`total_${metricKey}`] = values.reduce((a, b) => a + b, 0);
        stats[`min_${metricKey}`] = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
        stats[`max_${metricKey}`] = Math.max(...values, 0);
      } else {
        const validValues = values.filter((v, i) => v > 0 && metrics.population[i] > 0);
        stats[`avg_${metricKey}`] = calculateWeightedAverage(values, metrics.population);
        stats[`min_${metricKey}`] = validValues.length > 0 ? Math.min(...validValues) : 0;
        stats[`max_${metricKey}`] = Math.max(...values, 0);
      }
    }
  });
  
  return stats;
}

function calculateScoreStatistics(features) {
  // console.log('calculateScoreStatistics called from:');
  const selectedYear = ScoresYear.value;
  const selectedPurpose = ScoresPurpose.value;
  const selectedMode = ScoresMode.value;
  
  let scoreField, percentileField;
  if (selectedYear === '2024 (DfT)') {
    scoreField = `dft_${selectedPurpose}_${selectedMode}`;
    percentileField = `dft_${selectedPurpose}_${selectedMode}_100`;
  } else {
    scoreField = `${selectedPurpose}_${selectedMode}`;
    percentileField = `${selectedPurpose}_${selectedMode}_100`;
  }
  
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
    minScore: Math.min(...metrics.score.filter(val => val > 0)),
    maxScore: Math.max(...metrics.score),
    avgPercentile: calculateWeightedAverage(metrics.percentile, metrics.population),
    minPercentile: Math.min(...metrics.percentile.filter(val => val > 0)),
    maxPercentile: Math.max(...metrics.percentile),
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
    const hexId = props.hex_id;
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
    const hexId = feature.properties.hex_id;
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
  const setStat = (id, value, options = {}) => {
    const el = document.getElementById(id);
    if (!el) return;
    const { maxForStep, stepOverride } = typeof options === 'object' ? options : { maxForStep: options };
    const step = stepOverride !== undefined ? stepOverride : chooseStepFromMax(maxForStep);
    el.textContent = formatValue(value, step);
  };

  const scoreRow = document.getElementById('avg-score')?.closest('tr');
  const percentileRow = document.getElementById('avg-percentile')?.closest('tr');
  const scoreLabel = document.getElementById('metric-row-1');
  const percentileLabel = document.getElementById('metric-row-2');
  const setRowVisibility = (row, visible) => { if (row) row.style.display = visible ? '' : 'none'; };

  // Base stats with dynamic rounding based on max values
  setStat('total-population', stats.totalPopulation, { maxForStep: stats.maxPopulation });
  setStat('min-population', stats.minPopulation, { maxForStep: stats.maxPopulation });
  setStat('max-population', stats.maxPopulation, { maxForStep: stats.maxPopulation });

  // IMD decile: force whole numbers
  setStat('avg-imd-decile', stats.avgImdDecile, { stepOverride: 1 });
  setStat('min-imd-decile', stats.minImdDecile, { stepOverride: 1 });
  setStat('max-imd-decile', stats.maxImdDecile, { stepOverride: 1 });

  setStat('avg-car-availability', stats.avgCarAvailability, { maxForStep: stats.maxCarAvailability });
  setStat('min-car-availability', stats.minCarAvailability, { maxForStep: stats.maxCarAvailability });
  setStat('max-car-availability', stats.maxCarAvailability, { maxForStep: stats.maxCarAvailability });

  const metricRow1 = document.getElementById('metric-row-1');
  if (metricRow1) metricRow1.textContent = stats.metricRow1 || '-';
  const metricRow2 = document.getElementById('metric-row-2');
  if (metricRow2) metricRow2.textContent = stats.metricRow2 || '-';
  
  if (stats.isScoreLayer) {
    setRowVisibility(scoreRow, true);
    setRowVisibility(percentileRow, true);
    if (scoreLabel) scoreLabel.textContent = stats.metricRow1 || 'Score';
    if (percentileLabel) percentileLabel.textContent = stats.metricRow2 || 'Score Percentile';

    const formatScore = value => stats.selectedYear.includes('-') ? `${(value * 100).toFixed(1)}%` : formatValue(value, 1);
    const avgScoreEl = document.getElementById('avg-score');
    const minScoreEl = document.getElementById('min-score');
    const maxScoreEl = document.getElementById('max-score');
    const avgPctEl = document.getElementById('avg-percentile');
    const minPctEl = document.getElementById('min-percentile');
    const maxPctEl = document.getElementById('max-percentile');

    if (avgScoreEl) avgScoreEl.textContent = formatScore(stats.avgScore);
    if (minScoreEl) minScoreEl.textContent = formatScore(stats.minScore);
    if (maxScoreEl) maxScoreEl.textContent = formatScore(stats.maxScore);
    if (avgPctEl) avgPctEl.textContent = formatValue(stats.avgPercentile, 1);
    if (minPctEl) minPctEl.textContent = formatValue(stats.minPercentile, 1);
    if (maxPctEl) maxPctEl.textContent = formatValue(stats.maxPercentile, 1);
  } 
  else if (stats.isTimeLayer) {
    setRowVisibility(scoreRow, false);
    setRowVisibility(percentileRow, true);
    if (percentileLabel) percentileLabel.textContent = 'Journey Time (minutes)';

    const avgScoreEl = document.getElementById('avg-score');
    const minScoreEl = document.getElementById('min-score');
    const maxScoreEl = document.getElementById('max-score');
    const avgPctEl = document.getElementById('avg-percentile');
    const minPctEl = document.getElementById('min-percentile');
    const maxPctEl = document.getElementById('max-percentile');

    if (avgScoreEl) avgScoreEl.textContent = '-';
    if (minScoreEl) minScoreEl.textContent = '-';
    if (maxScoreEl) maxScoreEl.textContent = '-';
    if (avgPctEl) avgPctEl.textContent = formatValue(stats.avgTime, 1);
    if (minPctEl) minPctEl.textContent = formatValue(stats.minTime, 1);
    if (maxPctEl) maxPctEl.textContent = formatValue(stats.maxTime, 1);
  }
  
  // Update dynamic metrics
  const tableRows = document.querySelectorAll('#summary-table-body .metric-row[data-metric-key]');
  tableRows.forEach(row => {
    const metricKey = row.dataset.metricKey;
    const metric = availableMetrics[metricKey];
    if (!metric) return;
    
    const maxVal = stats[`max_${metricKey}`];
    const step = metricKey === 'imd_decile_mhclg' ? 1 : chooseStepFromMax(maxVal);

    if (metric.aggregation === 'total') {
      const totalElem = document.getElementById(`total-${metricKey}`);
      const minElem = document.getElementById(`min-${metricKey}`);
      const maxElem = document.getElementById(`max-${metricKey}`);
      const avgElem = document.getElementById(`avg-${metricKey}`);
      
      if (totalElem) totalElem.textContent = formatValue(stats[`total_${metricKey}`] || 0, step);
      if (minElem) minElem.textContent = formatValue(stats[`min_${metricKey}`] || 0, step);
      if (maxElem) maxElem.textContent = formatValue(stats[`max_${metricKey}`] || 0, step);
      if (avgElem) avgElem.textContent = '-';
    } else {
      const avgElem = document.getElementById(`avg-${metricKey}`);
      const minElem = document.getElementById(`min-${metricKey}`);
      const maxElem = document.getElementById(`max-${metricKey}`);
      const totalElem = document.getElementById(`total-${metricKey}`);
      
      if (avgElem) avgElem.textContent = formatValue(stats[`avg_${metricKey}`] || 0, step);
      if (minElem) minElem.textContent = formatValue(stats[`min_${metricKey}`] || 0, step);
      if (maxElem) maxElem.textContent = formatValue(stats[`max_${metricKey}`] || 0, step);
      if (totalElem) totalElem.textContent = '-';
    }
  });

  if (!stats.isScoreLayer && !stats.isTimeLayer) {
    setRowVisibility(scoreRow, false);
    setRowVisibility(percentileRow, false);
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
      const hexId = feature.properties.hex_id;
      const time = hexTimeMap[hexId];
      return time > 30;
    });
  } else {
    const [minRange, maxRange] = filterValue.split('-').map(parseFloat);
    return features.filter(feature => {
      const hexId = feature.properties.hex_id;
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

// ============================================================================
// METRICS TABLE MANAGEMENT
// ============================================================================

const availableMetrics = {
  // -----------------------------------------------------------------------
  // Base / Reference
  // -----------------------------------------------------------------------
  'total_score': { name: 'Total Score', dataField: 'Total Score', aggregation: 'average' },
  'pop': { name: 'Population (2025)', dataField: 'pop', aggregation: 'total' },
  'car_availability': { name: 'Car Availability (per household)', dataField: 'hh_caravail_ts045', aggregation: 'average' },
  'popemp': { name: 'Residents in Employment (2025)', dataField: 'popemp', aggregation: 'total' },
  'jobs': { name: 'Jobs (2025)', dataField: 'jobs', aggregation: 'total' },
  'hh': { name: 'Households (2025)', dataField: 'hh', aggregation: 'total' },
  'imd_decile_mhclg': { name: 'IMD Decile', dataField: 'imd_decile_mhclg', aggregation: 'average' },
  
  // Growth & Futures
  'pop_growth': { name: 'Population Growth', dataField: 'pop_growth', aggregation: 'total' },
  'jobs_growth': { name: 'Jobs Growth', dataField: 'jobs_growth', aggregation: 'total' },
  'hh_growth': { name: 'Household Growth', dataField: 'hh_growth', aggregation: 'total' },
  'emp_ha_growth': { name: 'Employment Land Growth (Ha)', dataField: 'emp_ha_growth', aggregation: 'total' },
  'pop_fut': { name: 'Population (future)', dataField: 'pop_fut', aggregation: 'total' },
  'jobs_fut': { name: 'Jobs (future)', dataField: 'jobs_fut', aggregation: 'total' },
  'hh_fut': { name: 'Households (future)', dataField: 'hh_fut', aggregation: 'total' },
  
  // TS007 Age by Single Year (counts)
  'pop_0-4_ts007': { name: 'Population aged 0–4', dataField: 'pop_0-4_ts007', aggregation: 'total' },
  'pop_5-9_ts007': { name: 'Population aged 5–9', dataField: 'pop_5-9_ts007', aggregation: 'total' },
  'pop_10-15_ts007': { name: 'Population aged 10–15', dataField: 'pop_10-15_ts007', aggregation: 'total' },
  'pop_16-19_ts007': { name: 'Population aged 16–19', dataField: 'pop_16-19_ts007', aggregation: 'total' },
  'pop_20-24_ts007': { name: 'Population aged 20–24', dataField: 'pop_20-24_ts007', aggregation: 'total' },
  'pop_25-34_ts007': { name: 'Population aged 25–34', dataField: 'pop_25-34_ts007', aggregation: 'total' },
  'pop_35-49_ts007': { name: 'Population aged 35–49', dataField: 'pop_35-49_ts007', aggregation: 'total' },
  'pop_50-64_ts007': { name: 'Population aged 50–64', dataField: 'pop_50-64_ts007', aggregation: 'total' },
  'pop_65-74_ts007': { name: 'Population aged 65–74', dataField: 'pop_65-74_ts007', aggregation: 'total' },
  'pop_75-84_ts007': { name: 'Population aged 75–84', dataField: 'pop_75-84_ts007', aggregation: 'total' },
  'pop_85+_ts007': { name: 'Population aged 85 and over', dataField: 'pop_85+_ts007', aggregation: 'total' },
  // TS007 Age by Single Year (percent)
  'pop_0-4%_ts007': { name: 'Population aged 0–4 (% of population)', dataField: 'pop_0-4%_ts007', aggregation: 'average' },
  'pop_5-9%_ts007': { name: 'Population aged 5–9 (% of population)', dataField: 'pop_5-9%_ts007', aggregation: 'average' },
  'pop_10-15%_ts007': { name: 'Population aged 10–15 (% of population)', dataField: 'pop_10-15%_ts007', aggregation: 'average' },
  'pop_16-19%_ts007': { name: 'Population aged 16–19 (% of population)', dataField: 'pop_16-19%_ts007', aggregation: 'average' },
  'pop_20-24%_ts007': { name: 'Population aged 20–24 (% of population)', dataField: 'pop_20-24%_ts007', aggregation: 'average' },
  'pop_25-34%_ts007': { name: 'Population aged 25–34 (% of population)', dataField: 'pop_25-34%_ts007', aggregation: 'average' },
  'pop_35-49%_ts007': { name: 'Population aged 35–49 (% of population)', dataField: 'pop_35-49%_ts007', aggregation: 'average' },
  'pop_50-64%_ts007': { name: 'Population aged 50–64 (% of population)', dataField: 'pop_50-64%_ts007', aggregation: 'average' },
  'pop_65-74%_ts007': { name: 'Population aged 65–74 (% of population)', dataField: 'pop_65-74%_ts007', aggregation: 'average' },
  'pop_75-84%_ts007': { name: 'Population aged 75–84 (% of population)', dataField: 'pop_75-84%_ts007', aggregation: 'average' },
  'pop_85+%_ts007': { name: 'Population aged 85 and over (% of population)', dataField: 'pop_85+%_ts007', aggregation: 'average' },
  
  // TS008 Sex
  'pop_f_ts008': { name: 'Female population', dataField: 'pop_f_ts008', aggregation: 'total' },
  'pop_m_ts008': { name: 'Male population', dataField: 'pop_m_ts008', aggregation: 'total' },
  'pop_f%_ts008': { name: 'Female population (% of population)', dataField: 'pop_f%_ts008', aggregation: 'average' },
  'pop_m%_ts008': { name: 'Male population (% of population)', dataField: 'pop_m%_ts008', aggregation: 'average' },
  
  // TS038 Disability / Long-term Conditions
  'pop_dis_vlim_ts038': { name: 'Disabled under the Equality Act: Day-to-day activities limited a lot', dataField: 'pop_dis_vlim_ts038', aggregation: 'total' },
  'pop_dis_llim_ts038': { name: 'Disabled under the Equality Act: Day-to-day activities limited a little', dataField: 'pop_dis_llim_ts038', aggregation: 'total' },
  'pop_ltc_nlim_ts038': { name: 'Not disabled under the Equality Act: Has long term physical or mental health condition but day-to-day activities are not limited', dataField: 'pop_ltc_nlim_ts038', aggregation: 'total' },
  'pop_nltc_nlim_ts038': { name: 'Not disabled under the Equality Act: No long term physical or mental health conditions', dataField: 'pop_nltc_nlim_ts038', aggregation: 'total' },
  'pop_dis_vlim%_ts038': { name: 'Disabled under the Equality Act: Day-to-day activities limited a lot (% of population)', dataField: 'pop_dis_vlim%_ts038', aggregation: 'average' },
  'pop_dis_llim%_ts038': { name: 'Disabled under the Equality Act: Day-to-day activities limited a little (% of population)', dataField: 'pop_dis_llim%_ts038', aggregation: 'average' },
  'pop_ltc_nlim%_ts038': { name: 'Not disabled under the Equality Act: Has long term physical or mental health condition but day-to-day activities are not limited (% of population)', dataField: 'pop_ltc_nlim%_ts038', aggregation: 'average' },
  'pop_nltc_nlim%_ts038': { name: 'Not disabled under the Equality Act: No long term physical or mental health conditions (% of population)', dataField: 'pop_nltc_nlim%_ts038', aggregation: 'average' },
    
  // TS061 Method of Travel to Work (residents) - counts
  'popemp_ttw_wfh_ts061': { name: 'Residents Travel to Work - Work from home', dataField: 'popemp_ttw_wfh_ts061', aggregation: 'total' },
  'popemp_ttw_train_ts061': { name: 'Residents Travel to Work - Train/metro/rail', dataField: 'popemp_ttw_train_ts061', aggregation: 'total' },
  'popemp_ttw_bus_ts061': { name: 'Residents Travel to Work - Bus/coach', dataField: 'popemp_ttw_bus_ts061', aggregation: 'total' },
  'popemp_ttw_moto_ts061': { name: 'Residents Travel to Work - Motorcycle/scooter', dataField: 'popemp_ttw_moto_ts061', aggregation: 'total' },
  'popemp_ttw_cardr_ts061': { name: 'Residents Travel to Work - Car/van driver', dataField: 'popemp_ttw_cardr_ts061', aggregation: 'total' },
  'popemp_ttw_carpass_ts061': { name: 'Residents Travel to Work - Car/van passenger', dataField: 'popemp_ttw_carpass_ts061', aggregation: 'total' },
  'popemp_ttw_bike_ts061': { name: 'Residents Travel to Work - Bicycle', dataField: 'popemp_ttw_bike_ts061', aggregation: 'total' },
  'popemp_ttw_ped_ts061': { name: 'Residents Travel to Work - On foot', dataField: 'popemp_ttw_ped_ts061', aggregation: 'total' },
  // TS061 Method of Travel to Work (residents) - percent
  'popemp_ttw_wfh%_ts061': { name: 'Residents Travel to Work - Work from home (% of employed population)', dataField: 'popemp_ttw_wfh%_ts061', aggregation: 'average' },
  'popemp_ttw_train%_ts061': { name: 'Residents Travel to Work - Train/metro/rail (% of employed population)', dataField: 'popemp_ttw_train%_ts061', aggregation: 'average' },
  'popemp_ttw_bus%_ts061': { name: 'Residents Travel to Work - Bus/coach (% of employed population)', dataField: 'popemp_ttw_bus%_ts061', aggregation: 'average' },
  'popemp_ttw_moto%_ts061': { name: 'Residents Travel to Work - Motorcycle/scooter (% of employed population)', dataField: 'popemp_ttw_moto%_ts061', aggregation: 'average' },
  'popemp_ttw_cardr%_ts061': { name: 'Residents Travel to Work - Car/van driver (% of employed population)', dataField: 'popemp_ttw_cardr%_ts061', aggregation: 'average' },
  'popemp_ttw_carpass%_ts061': { name: 'Residents Travel to Work - Car/van passenger (% of employed population)', dataField: 'popemp_ttw_carpass%_ts061', aggregation: 'average' },
  'popemp_ttw_bike%_ts061': { name: 'Residents Travel to Work - Bicycle (% of employed population)', dataField: 'popemp_ttw_bike%_ts061', aggregation: 'average' },
  'popemp_ttw_ped%_ts061': { name: 'Residents Travel to Work - On foot (% of employed population)', dataField: 'popemp_ttw_ped%_ts061', aggregation: 'average' },
  
  // TS066 Economic Activity (16+)
  'pop16plus_nstud_unemp_ts066': { name: 'Unemployed population (not retired nor student)', dataField: 'pop16plus_nstud_unemp_ts066', aggregation: 'total' },
  'pop16plus_homemaker_ts066': { name: 'Stay-at-home population', dataField: 'pop16plus_homemaker_ts066', aggregation: 'total' },
  'pop16plus_nstud_unemp%_ts066': { name: 'Unemployed population (not retired nor student) (% of population aged 16 and over)', dataField: 'pop16plus_nstud_unemp%_ts066', aggregation: 'average' },
  'pop16plus_homemaker%_ts066': { name: 'Stay-at-home population (% of population aged 16 and over)', dataField: 'pop16plus_homemaker%_ts066', aggregation: 'average' },
  
  // TS067 Highest Qualification (16+)
  'pop16plus_level0_ts067': { name: 'Highest Qualification - None', dataField: 'pop16plus_level0_ts067', aggregation: 'total' },
  'pop16plus_level1_ts067': { name: 'Highest Qualification - Level 1', dataField: 'pop16plus_level1_ts067', aggregation: 'total' },
  'pop16plus_level2_ts067': { name: 'Highest Qualification - Level 2', dataField: 'pop16plus_level2_ts067', aggregation: 'total' },
  'pop16plus_apprentice_ts067': { name: 'Highest Qualification - Apprenticeship', dataField: 'pop16plus_apprentice_ts067', aggregation: 'total' },
  'pop16plus_level3_ts067': { name: 'Highest Qualification - Level 3', dataField: 'pop16plus_level3_ts067', aggregation: 'total' },
  'pop16plus_level4_ts067': { name: 'Highest Qualification - Level 4+', dataField: 'pop16plus_level4_ts067', aggregation: 'total' },
  'pop16plus_level0%_ts067': { name: 'Highest Qualification - None (% of population aged 16 and over)', dataField: 'pop16plus_level0%_ts067', aggregation: 'average' },
  'pop16plus_level1%_ts067': { name: 'Highest Qualification - Level 1 (% of population aged 16 and over)', dataField: 'pop16plus_level1%_ts067', aggregation: 'average' },
  'pop16plus_level2%_ts067': { name: 'Highest Qualification - Level 2 (% of population aged 16 and over)', dataField: 'pop16plus_level2%_ts067', aggregation: 'average' },
  'pop16plus_apprentice%_ts067': { name: 'Highest Qualification - Apprenticeship (% of population aged 16 and over)', dataField: 'pop16plus_apprentice%_ts067', aggregation: 'average' },
  'pop16plus_level3%_ts067': { name: 'Highest Qualification - Level 3 (% of population aged 16 and over)', dataField: 'pop16plus_level3%_ts067', aggregation: 'average' },
  'pop16plus_level4%_ts067': { name: 'Highest Qualification - Level 4+ (% of population aged 16 and over)', dataField: 'pop16plus_level4%_ts067', aggregation: 'average' },
  
  // WP025 Workplace Population by Mode (workplace-based counts)
  'workpop_ttw_bike_wp025': { name: 'Workplace population Travel to Work - bicycle', dataField: 'workpop_ttw_bike_wp025', aggregation: 'total' },
  'workpop_ttw_bus_wp025': { name: 'Workplace population Travel to Work - bus/coach', dataField: 'workpop_ttw_bus_wp025', aggregation: 'total' },
  'workpop_ttw_cardr_wp025': { name: 'Workplace population Travel to Work - car/van driver', dataField: 'workpop_ttw_cardr_wp025', aggregation: 'total' },
  'workpop_ttw_moto_wp025': { name: 'Workplace population Travel to Work - motorcycle/scooter', dataField: 'workpop_ttw_moto_wp025', aggregation: 'total' },
  'workpop_ttw_ped_wp025': { name: 'Workplace population Travel to Work - on foot', dataField: 'workpop_ttw_ped_wp025', aggregation: 'total' },
  'workpop_ttw_carpass_wp025': { name: 'Workplace population Travel to Work - car/van passenger', dataField: 'workpop_ttw_carpass_wp025', aggregation: 'total' },
  'workpop_ttw_train_wp025': { name: 'Workplace population Travel to Work - train/metro/rail', dataField: 'workpop_ttw_train_wp025', aggregation: 'total' },
  'workpop_ttw_wfh_wp025': { name: 'Workplace population Travel to Work - work from home', dataField: 'workpop_ttw_wfh_wp025', aggregation: 'total' },

  // WP025 Workplace Population by Mode (percent)
  'workpop_ttw_bike%_wp025': { name: 'Workplace population Travel to Work - bicycle (% of workplace population)', dataField: 'workpop_ttw_bike%_wp025', aggregation: 'average' },
  'workpop_ttw_bus%_wp025': { name: 'Workplace population Travel to Work - bus/coach (% of workplace population)', dataField: 'workpop_ttw_bus%_wp025', aggregation: 'average' },
  'workpop_ttw_cardr%_wp025': { name: 'Workplace population Travel to Work - car/van driver (% of workplace population)', dataField: 'workpop_ttw_cardr%_wp025', aggregation: 'average' },
  'workpop_ttw_moto%_wp025': { name: 'Workplace population Travel to Work - motorcycle/scooter (% of workplace population)', dataField: 'workpop_ttw_moto%_wp025', aggregation: 'average' },
  'workpop_ttw_ped%_wp025': { name: 'Workplace population Travel to Work - on foot (% of workplace population)', dataField: 'workpop_ttw_ped%_wp025', aggregation: 'average' },
  'workpop_ttw_carpass%_wp025': { name: 'Workplace population Travel to Work - car/van passenger (% of workplace population)', dataField: 'workpop_ttw_carpass%_wp025', aggregation: 'average' },
  'workpop_ttw_train%_wp025': { name: 'Workplace population Travel to Work - train/metro/rail (% of workplace population)', dataField: 'workpop_ttw_train%_wp025', aggregation: 'average' },
  'workpop_ttw_wfh%_wp025': { name: 'Workplace population Travel to Work - work from home (% of workplace population)', dataField: 'workpop_ttw_wfh%_wp025', aggregation: 'average' },
};

// Populate link hexagon transparency/outline dropdowns with metrics
initializeLinkMetricDropdowns();

let activeMetrics = ['Score', 'Score Percentile', 'Population (2025)', 'IMD Decile', 'Car Availability'];

/**
 * Initialize the metrics dropdown with available options
 */
function initializeMetricsDropdown() {
  const dropdown = document.getElementById('add-metric-dropdown');
  if (!dropdown) return;
  
  // Clear existing options except the first one
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }
  
  // Add available metrics that aren't already displayed
  Object.keys(availableMetrics).forEach(key => {
    const metric = availableMetrics[key];
    const isActive = activeMetrics.includes(metric.name);
    
    if (!isActive) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = metric.name;
      dropdown.appendChild(option);
    }
  });

  // Reapply any active search filter
  const searchInput = document.getElementById('addMetricSearch');
  applySelectFilter(searchInput, dropdown);
}

/**
 * Handle adding a new metric row
 */
document.addEventListener('DOMContentLoaded', () => {
  const dropdown = document.getElementById('add-metric-dropdown');
  if (dropdown) {
    attachSelectSearch('addMetricSearch', dropdown);
    dropdown.addEventListener('change', function() {
      if (this.value) {
        addMetricRow(this.value);
        this.value = '';
        initializeMetricsDropdown();
      }
    });
  }
  
  // Initialize amenities table collapse toggle
  setupAmenitiesToggle();
  
  // Initialize dropdown on load
  initializeMetricsDropdown();
});

/**
 * Setup amenities table toggle
 */
function setupAmenitiesToggle() {
  const toggleAmenitiesBtn = document.getElementById('toggle-amenities-table');
  const amenitiesContent = document.getElementById('amenities-content');
  
  if (toggleAmenitiesBtn && amenitiesContent) {
    // Remove existing listeners to avoid duplicates
    const newAmenitiesBtn = toggleAmenitiesBtn.cloneNode(true);
    toggleAmenitiesBtn.parentNode.replaceChild(newAmenitiesBtn, toggleAmenitiesBtn);
    
    newAmenitiesBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = amenitiesContent.style.display !== 'none';
      amenitiesContent.style.display = isOpen ? 'none' : 'block';
      this.textContent = isOpen ? 'Amenities within Area ▶' : 'Amenities within Area ▼';
    });
  }
  
  const toggleStatisticsBtn = document.getElementById('toggle-statistics-table');
  const statisticsContent = document.getElementById('statistics-content');
  
  if (toggleStatisticsBtn && statisticsContent) {
    // Remove existing listeners to avoid duplicates
    const newStatisticsBtn = toggleStatisticsBtn.cloneNode(true);
    toggleStatisticsBtn.parentNode.replaceChild(newStatisticsBtn, toggleStatisticsBtn);
    
    newStatisticsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = statisticsContent.style.display !== 'none';
      statisticsContent.style.display = isOpen ? 'none' : 'block';
      this.textContent = isOpen ? 'Statistics table ▶' : 'Statistics table ▼';
    });
  }
}

/**
 * Add a new metric row to the table
 */
function addMetricRow(metricKey) {
  const metric = availableMetrics[metricKey];
  if (!metric) return;
  
  const tableBody = document.getElementById('summary-table-body');
  if (!tableBody) return;
  
  // Create new row
  const newRow = document.createElement('tr');
  newRow.className = 'metric-row';
  newRow.dataset.metricKey = metricKey;
  
  const cellContents = `
    <td>${metric.name}</td>
    <td id="avg-${metricKey}">-</td>
    <td id="total-${metricKey}">-</td>
    <td id="min-${metricKey}">-</td>
    <td id="max-${metricKey}">-</td>
    <td><button class="delete-metric-btn" onclick="deleteMetricRow(this)">✕</button></td>
  `;
  newRow.innerHTML = cellContents;
  
  // Insert before the "Add Metric" row
  const addMetricRow = document.getElementById('add-metric-row');
  if (addMetricRow) {
    tableBody.insertBefore(newRow, addMetricRow);
  } else {
    tableBody.appendChild(newRow);
  }
  
  // Add to active metrics
  activeMetrics.push(metric.name);
  
  // Update summary statistics
  updateSummaryStatistics(getCurrentFeatures());
}

/**
 * Delete a metric row from the table
 */
function deleteMetricRow(button) {
  const row = button.closest('tr');
  if (!row) return;
  
  const metricName = row.querySelector('td').textContent;
  const metricKey = row.dataset.metricKey;
  
  // Remove from active metrics
  activeMetrics = activeMetrics.filter(m => m !== metricName);
  
  // Remove the row
  row.remove();
  
  // Refresh dropdown options
  initializeMetricsDropdown();
}

/**
 * Get current features for statistics calculation
 */
function getCurrentFeatures() {
  let features = [];
  
  // Try to get features from active layers
  if (ScoresLayer) {
    const geoJson = ScoresLayer.toGeoJSON();
    features = geoJson.features || [];
  } else if (AmenitiesCatchmentLayer) {
    const geoJson = AmenitiesCatchmentLayer.toGeoJSON();
    features = geoJson.features || [];
  } else if (CensusLayer) {
    const geoJson = CensusLayer.toGeoJSON();
    features = geoJson.features || [];
  } else if (hexes) {
    // Fallback to hexes data
    features = hexes.features || [];
  }
  
  return features;
}

// ---------------------------------------------------------------------------
// Link hexagon transparency/outline dropdowns with metric list (like stats)
// ---------------------------------------------------------------------------
function buildMetricOptions(selectEl, defaultKeys = []) {
  if (!selectEl) return;
  const seen = new Set();
  const addOption = (key) => {
    const metric = availableMetrics[key];
    if (!metric || seen.has(metric.dataField)) return;
    const opt = document.createElement('option');
    opt.value = metric.dataField;
    opt.textContent = metric.name;
    selectEl.appendChild(opt);
    seen.add(metric.dataField);
  };

  // Always start with a None option
  selectEl.innerHTML = '';
  const noneOpt = document.createElement('option');
  noneOpt.value = 'None';
  noneOpt.textContent = '-';
  selectEl.appendChild(noneOpt);

  // Preferred defaults
  defaultKeys.forEach(addOption);

  // All remaining metrics
  Object.keys(availableMetrics).forEach(addOption);

  // Default selection should be unlinked
  selectEl.value = 'None';
}

function initializeLinkMetricDropdowns() {
  const defaults = ['pop', 'imd_decile_mhclg', 'hh_caravail_ts045'];
  [
    ScoresOpacity,
    ScoresOutline,
    AmenitiesOpacity,
    AmenitiesOutline,
    CensusOpacity,
    CensusOutline
  ].forEach(selectEl => buildMetricOptions(selectEl, defaults));

  attachSelectSearch('opacityFieldScoresSearch', ScoresOpacity);
  attachSelectSearch('outlineFieldScoresSearch', ScoresOutline);
  attachSelectSearch('opacityFieldAmenitiesSearch', AmenitiesOpacity);
  attachSelectSearch('outlineFieldAmenitiesSearch', AmenitiesOutline);
  attachSelectSearch('opacityFieldCensusSearch', CensusOpacity);
  attachSelectSearch('outlineFieldCensusSearch', CensusOutline);
}

function applySelectFilter(inputEl, selectEl) {
  if (!inputEl || !selectEl) return;
  const term = inputEl.value.trim().toLowerCase();
  const alwaysVisible = new Set(['', 'None']);
  Array.from(selectEl.options).forEach(opt => {
    const keep = alwaysVisible.has(opt.value);
    if (!term) {
      opt.hidden = false;
      return;
    }
    const text = (opt.textContent || '').toLowerCase();
    const value = (opt.value || '').toLowerCase();
    opt.hidden = !(keep || text.includes(term) || value.includes(term));
  });
}

function attachSelectSearch(inputId, selectEl) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl || !selectEl) return;
  const handler = () => applySelectFilter(inputEl, selectEl);
  inputEl.addEventListener('input', handler);
  inputEl.addEventListener('change', handler);
  handler();
}