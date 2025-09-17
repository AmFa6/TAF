// West of England Connectivity Tool - Configuration Data

// Score data files configuration
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

// Amenities data files configuration
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

// Infrastructure data files configuration
const InfrastructureFiles = [
  { type: 'BusLines', path: 'https://AmFa6.github.io/TAF_test/lines.geojson' },
  { type: 'BusStops', path: 'https://AmFa6.github.io/TAF_test/stops.geojson' }
];

// Purpose to amenities mapping
const purposeToAmenitiesMap = {
  Edu: ['PriSch', 'SecSch', 'FurEd'],
  Emp: ['Em500', 'Em5000', 'StrEmp'],
  HSt: ['CitCtr', 'MajCtr', 'DisCtr'],
  Hth: ['GP', 'Hos'],
  All: ['PriSch', 'SecSch', 'FurEd', 'Em500', 'Em5000', 'StrEmp', 'CitCtr', 'MajCtr', 'DisCtr', 'GP', 'Hos']
};

// Local Authority District codes
const ladCodes = ['E06000022', 'E06000023', 'E06000024', 'E06000025'];