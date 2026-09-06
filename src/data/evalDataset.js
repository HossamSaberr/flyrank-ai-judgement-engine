/**
 * Labeled Evaluation Benchmark Dataset
 * 12 Curated Articles with Ground Truth Target Image IDs and Hard Distractors
 */

const EVAL_DATASET = [
  {
    id: 'post-eval-01',
    title: 'The Autumn Forest Habitat of Wild Red Foxes',
    category: 'wildlife',
    expected_subject: 'red fox',
    content: 'An in-depth study of Vulpes vulpes, the wild red fox, exploring their agile hunting techniques among vibrant autumn foliage in temperate forests.',
    ground_truth_image_ids: ['img-fox-01', 'img-fox-02'],
    expected_status: 'matched',
    hard_negatives: ['img-wolf-01', 'img-dog-01']
  },
  {
    id: 'post-eval-02',
    title: 'Winter Snow Hunting Biology of Vulpes vulpes',
    category: 'wildlife',
    expected_subject: 'red fox',
    content: 'Scientific breakdown of Vulpes vulpes pouncing and diving into deep winter snow to capture prey underneath subzero snowdrifts.',
    ground_truth_image_ids: ['img-fox-02', 'img-fox-01'],
    expected_status: 'matched',
    hard_negatives: ['img-wolf-01', 'img-dog-01']
  },
  {
    id: 'post-eval-03',
    title: 'Apex Predators: The Social Structure of Gray Wolves',
    category: 'wildlife',
    expected_subject: 'gray wolf',
    content: 'Exploring the pack dynamics, hunting coordination, and territorial howling communication of Canis lupus in remote snowy forests.',
    ground_truth_image_ids: ['img-wolf-01', 'img-wolf-02'],
    expected_status: 'matched',
    hard_negatives: ['img-fox-01', 'img-dog-01']
  },
  {
    id: 'post-eval-04',
    title: 'Popular Family Pet Dogs: German Shepherds in the Backyard',
    category: 'domestic_animal',
    expected_subject: 'domestic dog',
    content: 'Training tips, loyalty, and companionship characteristics of domestic pet German Shepherd dogs sitting obediently on suburban garden lawns.',
    ground_truth_image_ids: ['img-dog-01', 'img-dog-02'],
    expected_status: 'matched',
    hard_negatives: ['img-wolf-01', 'img-fox-01']
  },
  {
    id: 'post-eval-05',
    title: 'Alaskan Brown Bears and River Salmon Migration',
    category: 'wildlife',
    expected_subject: 'brown bear',
    content: 'Documenting the summer salmon run where giant grizzly brown bears gather along roaring Alaskan waterfalls to fish for fresh salmon.',
    ground_truth_image_ids: ['img-bear-01'],
    expected_status: 'matched',
    hard_negatives: ['img-wolf-01', 'img-landscape-01']
  },
  {
    id: 'post-eval-06',
    title: 'Whitetail Deer Grazing in Forest Meadows',
    category: 'wildlife',
    expected_subject: 'whitetail deer',
    content: 'Observing the quiet grazing habits and antler growth of whitetail deer bucks during misty early mornings in temperate forest glades.',
    ground_truth_image_ids: ['img-deer-01'],
    expected_status: 'matched',
    hard_negatives: ['img-bear-01', 'img-landscape-01']
  },
  {
    id: 'post-eval-07',
    title: 'Majestic Raptors: Flight Dynamics of the Bald Eagle',
    category: 'birds',
    expected_subject: 'bald eagle',
    content: 'Aerodynamic analysis of the American bald eagle soaring through alpine mountain updrafts with outstretched wings and sharp eyesight.',
    ground_truth_image_ids: ['img-eagle-01'],
    expected_status: 'matched',
    hard_negatives: ['img-deer-01', 'img-landscape-01']
  },
  {
    id: 'post-eval-08',
    title: 'Glacial Ice Caves and Subzero Caverns of Iceland',
    category: 'landscape',
    expected_subject: 'glacier ice cave',
    content: 'Exploring the natural blue crystal ice caves formed deep underneath active European glaciers during subzero subarctic winters.',
    ground_truth_image_ids: ['img-landscape-04'],
    expected_status: 'matched',
    hard_negatives: ['img-landscape-03', 'img-landscape-02']
  },
  {
    id: 'post-eval-09',
    title: 'Cryogenic Dilution Refrigerators in Quantum Computing',
    category: 'technology',
    expected_subject: 'quantum computer',
    content: 'Engineering principles behind golden tiered dilution refrigerators cooling quantum computing superconducting qubits down to millikelvin temperatures.',
    ground_truth_image_ids: ['img-tech-01'],
    expected_status: 'matched',
    hard_negatives: ['img-food-01', 'img-arch-01']
  },
  {
    id: 'post-eval-10',
    title: 'Silicon Microchip Fabrication on Nanometer Wafers',
    category: 'technology',
    expected_subject: 'semiconductor microchip',
    content: 'Photolithography and cleanroom semiconductor manufacturing techniques for modern high-performance microprocessor transistor circuits.',
    ground_truth_image_ids: ['img-tech-02'],
    expected_status: 'matched',
    hard_negatives: ['img-food-02', 'img-arch-02']
  },
  {
    id: 'post-eval-11',
    title: 'Artisan Espresso Extraction and Rosetta Latte Art',
    category: 'culinary',
    expected_subject: 'artisan coffee',
    content: 'Mastering espresso grind size, extraction pressure, and velvety microfoam milk steaming to pour intricate rosetta latte art in specialty cafes.',
    ground_truth_image_ids: ['img-food-01'],
    expected_status: 'matched',
    hard_negatives: ['img-tech-01', 'img-wolf-01']
  },
  {
    id: 'post-eval-12',
    title: 'Deep Space Orbital Probes and Interplanetary Mars Rovers',
    category: 'aerospace',
    expected_subject: 'deep space probe',
    content: 'Telemetry, ion propulsion thrusters, and autonomous navigation for robotic exploratory probes travelling through the outer asteroid belt.',
    ground_truth_image_ids: [], // Negative control: No image in library matches!
    expected_status: 'no_confident_match', // Must refuse!
    hard_negatives: ['img-tech-01', 'img-tech-02', 'img-landscape-03']
  }
];

module.exports = { EVAL_DATASET };
