// West of England Connectivity Tool - Configuration Data
// Automatically detects environment and uses appropriate paths

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_PATH = isLocal ? '../TAF_test' : 'https://AmFa6.github.io/TAF_test';

const ScoresFiles = [
  { year: '2024', path: `${BASE_PATH}/ConnectScores/2024_connectscore.csv` },
  { year: '2024 (DfT)', path: `${BASE_PATH}/ConnectScores/grid_dft_scores.csv` },
  { year: '2023', path: `${BASE_PATH}/ConnectScores/2023_connectscore.csv` },
  { year: '2022', path: `${BASE_PATH}/ConnectScores/2022_connectscore.csv` },
  { year: '2019', path: `${BASE_PATH}/ConnectScores/2019_connectscore.csv` },
  { year: '2023-2024', path: `${BASE_PATH}/ConnectScores/2023-2024_connectscore.csv` },
  { year: '2019-2024', path: `${BASE_PATH}/ConnectScores/2019-2024_connectscore.csv` },
  { year: '2022-2023', path: `${BASE_PATH}/ConnectScores/2022-2023_connectscore.csv` },
  { year: '2019-2023', path: `${BASE_PATH}/ConnectScores/2019-2023_connectscore.csv` }, 
  { year: '2019-2022', path: `${BASE_PATH}/ConnectScores/2019-2022_connectscore.csv` }
];

const AmenitiesFiles = [
  { type: 'PriSch', path: `${BASE_PATH}/AmenitiesLocations/PriSch.geojson` },
  { type: 'SecSch', path: `${BASE_PATH}/AmenitiesLocations/SecSch.geojson` },
  { type: 'FurEd', path: `${BASE_PATH}/AmenitiesLocations/FurEd.geojson` },
  { type: 'Em500', path: `${BASE_PATH}/AmenitiesLocations/Em500.geojson` },
  { type: 'Em5000', path: `${BASE_PATH}/AmenitiesLocations/Em5000.geojson` },
  { type: 'StrEmp', path: `${BASE_PATH}/AmenitiesLocations/StrEmp.geojson` },
  { type: 'CitCtr', path: `${BASE_PATH}/AmenitiesLocations/CitCtr.geojson` },
  { type: 'MajCtr', path: `${BASE_PATH}/AmenitiesLocations/MajCtr.geojson` },
  { type: 'DisCtr', path: `${BASE_PATH}/AmenitiesLocations/DisCtr.geojson` },
  { type: 'GP', path: `${BASE_PATH}/AmenitiesLocations/GP.geojson` },
  { type: 'Hos', path: `${BASE_PATH}/AmenitiesLocations/Hos.geojson` }
];

const InfrastructureFiles = [
  { type: 'BusLines', path: `${BASE_PATH}/Infrastructure/lines.geojson` },
  { type: 'BusStops', path: `${BASE_PATH}/Infrastructure/stops.geojson` },
  { type: 'WestLink', path: `${BASE_PATH}/Infrastructure/westlink.geojson` },
  { type: 'RoadNetwork', path: `${BASE_PATH}/Infrastructure/simplified_network.geojson` }
];

const GeographyFiles = [
  { type: 'Hexes', path: `${BASE_PATH}/Boundaries/hexes800-socioeco.geojson` },
  { type: 'GrowthZones', path: `${BASE_PATH}/Boundaries/GrowthZones.geojson` }
];

const JourneyTimeFiles = {
  basePath: `${BASE_PATH}/JourneyTimes/`,
  getPath: (year, amenityType) => `${BASE_PATH}/JourneyTimes/${year}_${amenityType}_csv.csv`
};

const purposeToAmenitiesMap = {
  Edu: ['PriSch', 'SecSch', 'FurEd'],
  Emp: ['Em500', 'Em5000', 'StrEmp'],
  HSt: ['CitCtr', 'MajCtr', 'DisCtr'],
  Hth: ['GP', 'Hos'],
  All: ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos'],
  Lei: [],
  Shp: [],
  Res: []
};

const ladCodes = ['E06000023', 'E06000024', 'E06000022', 'E06000025'];