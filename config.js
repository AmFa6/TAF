// West of England Connectivity Tool - Configuration Data

const ScoresFiles = [
  { year: '2024', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2024_connectscore.csv' },
  { year: '2023', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2023_connectscore.csv' },
  { year: '2022', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2022_connectscore.csv' },
  { year: '2019', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2019_connectscore.csv' },
  { year: '2023-2024', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2023-2024_connectscore.csv' },
  { year: '2019-2024', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2019-2024_connectscore.csv' },
  { year: '2022-2023', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2022-2023_connectscore.csv' },
  { year: '2019-2023', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2019-2023_connectscore.csv' }, 
  { year: '2019-2022', path: 'https://AmFa6.github.io/TAF_test/ConnectScores/2019-2022_connectscore.csv' }
];

const AmenitiesFiles = [
  { type: 'PriSch', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/PriSch.geojson' },
  { type: 'SecSch', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/SecSch.geojson' },
  { type: 'FurEd', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/FurEd.geojson' },
  { type: 'Em500', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/Em500.geojson' },
  { type: 'Em5000', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/Em5000.geojson' },
  { type: 'StrEmp', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/StrEmp.geojson' },
  { type: 'CitCtr', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/CitCtr.geojson' },
  { type: 'MajCtr', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/MajCtr.geojson' },
  { type: 'DisCtr', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/DisCtr.geojson' },
  { type: 'GP', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/GP.geojson' },
  { type: 'Hos', path: 'https://AmFa6.github.io/TAF_test/AmenitiesLocations/Hos.geojson' }
];

const InfrastructureFiles = [
  { type: 'BusLines', path: 'https://AmFa6.github.io/TAF_test/Infrastructure/lines.geojson' },
  { type: 'BusStops', path: 'https://AmFa6.github.io/TAF_test/Infrastructure/stops.geojson' },
  { type: 'WestLink', path: 'https://AmFa6.github.io/TAF_test/Infrastructure/westlink.geojson' },
  { type: 'RoadNetwork', path: 'https://AmFa6.github.io/TAF_test/Infrastructure/simplified_network.geojson' }
];

const GeographyFiles = [
  { type: 'Hexes', path: 'https://AmFa6.github.io/TAF_test/Geographies/hexes-socioeco.geojson' },
  { type: 'GrowthZones', path: 'https://AmFa6.github.io/TAF_test/Geographies/GrowthZones.geojson' }
];

const JourneyTimeFiles = {
  basePath: 'https://AmFa6.github.io/TAF_test/JourneyTimes/',
  getPath: (year, amenityType) => `https://AmFa6.github.io/TAF_test/JourneyTimes/${year}_${amenityType}_csv.csv`
};

const purposeToAmenitiesMap = {
  Edu: ['PriSch', 'SecSch', 'FurEd'],
  Emp: ['Em500', 'Em5000', 'StrEmp'],
  HSt: ['CitCtr', 'MajCtr', 'DisCtr'],
  Hth: ['GP', 'Hos'],
  All: ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos']
};

const ladCodes = ['E06000022', 'E06000023', 'E06000024', 'E06000025'];