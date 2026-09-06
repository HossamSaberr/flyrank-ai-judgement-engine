/**
 * Curated 45+ Image Corpus across 5 Distinct Categories
 * Licensed under CC0 / Unsplash License (Free to use)
 */

const IMAGE_CORPUS = [
  // ==========================================
  // 1. CANINES & WILDLIFE ANIMALS (Core Eval Focus)
  // ==========================================
  {
    id: 'img-fox-01',
    filename: 'red_fox_autumn_forest.jpg',
    url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'red fox',
      category: 'wildlife',
      attributes: ['orange fur', 'bushy tail', 'white chest', 'pointed ears', 'autumn forest'],
      caption: 'A vibrant wild red fox (Vulpes vulpes) standing alert among autumn foliage',
      confidence: 0.96
    }
  },
  {
    id: 'img-fox-02',
    filename: 'red_fox_snow_hunting.jpg',
    url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'red fox',
      category: 'wildlife',
      attributes: ['red fur', 'snow', 'winter', 'hunting', 'pouncing posture'],
      caption: 'A red fox diving into deep winter snow hunting for prey',
      confidence: 0.94
    }
  },
  {
    id: 'img-fox-03',
    filename: 'arctic_fox_winter.jpg',
    url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'arctic fox',
      category: 'wildlife',
      attributes: ['white fur', 'tundra', 'arctic', 'cold climate', 'small ears'],
      caption: 'An arctic fox with thick pure white winter coat resting on tundra snow',
      confidence: 0.92
    }
  },
  {
    id: 'img-wolf-01',
    filename: 'gray_wolf_snowy_woods.jpg',
    url: 'https://images.unsplash.com/photo-1564419320461-6870880221ad?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'gray wolf',
      category: 'wildlife',
      attributes: ['gray fur', 'predator', 'canis lupus', 'pack animal', 'snowy pines'],
      caption: 'A majestic gray wolf (Canis lupus) prowling through a snowy pine forest',
      confidence: 0.95
    }
  },
  {
    id: 'img-wolf-02',
    filename: 'timber_wolf_howling.jpg',
    url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'timber wolf',
      category: 'wildlife',
      attributes: ['dark gray fur', 'howling', 'rocky cliff', 'wild predator'],
      caption: 'A lone timber wolf standing on a rocky outcrop howling towards the sky',
      confidence: 0.93
    }
  },
  {
    id: 'img-dog-01',
    filename: 'german_shepherd_backyard.jpg',
    url: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5455?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'domestic dog',
      category: 'domestic_animal',
      attributes: ['german shepherd', 'black and tan fur', 'collar', 'suburban garden', 'pet'],
      caption: 'A friendly German Shepherd domestic pet dog sitting obediently on green grass',
      confidence: 0.95
    }
  },
  {
    id: 'img-dog-02',
    filename: 'golden_retriever_running.jpg',
    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'domestic dog',
      category: 'domestic_animal',
      attributes: ['golden retriever', 'yellow coat', 'playing fetch', 'park', 'family pet'],
      caption: 'A happy Golden Retriever dog running across an open grassy meadow',
      confidence: 0.96
    }
  },
  {
    id: 'img-bear-01',
    filename: 'grizzly_bear_river_fishing.jpg',
    url: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'brown bear',
      category: 'wildlife',
      attributes: ['grizzly bear', 'brown fur', 'salmon river', 'alaska wildlife'],
      caption: 'A large grizzly brown bear catching fresh salmon in a rushing Alaskan river',
      confidence: 0.97
    }
  },
  {
    id: 'img-deer-01',
    filename: 'whitetail_deer_meadow.jpg',
    url: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'whitetail deer',
      category: 'wildlife',
      attributes: ['antlers', 'buck', 'spotted meadow', 'morning mist', 'herbivore'],
      caption: 'A graceful whitetail deer buck grazing in a sunlit morning meadow',
      confidence: 0.94
    }
  },
  {
    id: 'img-eagle-01',
    filename: 'bald_eagle_flight.jpg',
    url: 'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'bald eagle',
      category: 'birds',
      attributes: ['white head feathers', 'curved beak', 'wingspan', 'raptor', 'sky'],
      caption: 'An American bald eagle soaring majestically with outstretched wings against blue sky',
      confidence: 0.96
    }
  },

  // ==========================================
  // 2. LANDSCAPES & NATURE
  // ==========================================
  {
    id: 'img-landscape-01',
    filename: 'autumn_mountain_lake.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'alpine lake',
      category: 'landscape',
      attributes: ['crystal water', 'mountain reflection', 'pine trees', 'canadian rockies'],
      caption: 'A serene alpine mountain lake reflecting turquoise peaks and evergreen forest',
      confidence: 0.98
    }
  },
  {
    id: 'img-landscape-02',
    filename: 'tropical_sandy_beach.jpg',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'tropical beach',
      category: 'landscape',
      attributes: ['white sand', 'turquoise ocean', 'palm trees', 'sunny coast'],
      caption: 'A pristine tropical coastline with white sandy beach and crystal clear waters',
      confidence: 0.97
    }
  },
  {
    id: 'img-landscape-03',
    filename: 'sahara_desert_dunes.jpg',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'sand dunes',
      category: 'landscape',
      attributes: ['golden sand', 'desert ripples', 'arid climate', 'sunset horizon'],
      caption: 'Sweeping golden sand dunes under a warm sunset glow in the Sahara desert',
      confidence: 0.96
    }
  },
  {
    id: 'img-landscape-04',
    filename: 'glacier_ice_cave.jpg',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'glacier ice cave',
      category: 'landscape',
      attributes: ['blue ice', 'subzero frozen cavern', 'iceland winter', 'crystal formations'],
      caption: 'An ethereal luminous blue ice cave carved naturally inside an Icelandic glacier',
      confidence: 0.95
    }
  },

  // ==========================================
  // 3. TECHNOLOGY & COMPUTING
  // ==========================================
  {
    id: 'img-tech-01',
    filename: 'quantum_computer_cryostat.jpg',
    url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'quantum computer',
      category: 'technology',
      attributes: ['golden chandelier', 'cryogenic dilution refrigerator', 'qubits', 'physics lab'],
      caption: 'A golden tiered quantum computing cryostat refrigerator for qubit supercooling',
      confidence: 0.94
    }
  },
  {
    id: 'img-tech-02',
    filename: 'silicon_microchip_wafer.jpg',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'semiconductor microchip',
      category: 'technology',
      attributes: ['silicon wafer', 'integrated circuit', 'nanometer transistors', 'cleanroom'],
      caption: 'A detailed macro view of an advanced semiconductor silicon microchip processor',
      confidence: 0.96
    }
  },
  {
    id: 'img-tech-03',
    filename: 'datacenter_server_racks.jpg',
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'datacenter server racks',
      category: 'technology',
      attributes: ['flashing led lights', 'ethernet cables', 'cloud infrastructure', 'server room'],
      caption: 'Rows of high-density blade servers operating inside a modern enterprise cloud datacenter',
      confidence: 0.97
    }
  },
  {
    id: 'img-tech-04',
    filename: 'ai_neural_network_nodes.jpg',
    url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'neural network visualization',
      category: 'technology',
      attributes: ['connected nodes', 'glowing synapses', 'deep learning model', 'data flow'],
      caption: 'A 3D visualization of interconnected glowing neural network nodes and artificial intelligence',
      confidence: 0.93
    }
  },

  // ==========================================
  // 4. ARCHITECTURE & URBAN DESIGN
  // ==========================================
  {
    id: 'img-arch-01',
    filename: 'modern_glass_skyscraper.jpg',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'modern skyscraper',
      category: 'architecture',
      attributes: ['glass facade', 'geometric angles', 'financial district', 'clouds reflection'],
      caption: 'A contemporary high-rise glass skyscraper looking up against dramatic blue skies',
      confidence: 0.98
    }
  },
  {
    id: 'img-arch-02',
    filename: 'roman_colosseum_ancient.jpg',
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'roman colosseum',
      category: 'architecture',
      attributes: ['ancient arches', 'travertine limestone', 'historical amphitheater', 'rome italy'],
      caption: 'The ancient Flavian Amphitheatre Colosseum under warm Mediterranean afternoon sunlight',
      confidence: 0.99
    }
  },
  {
    id: 'img-arch-03',
    filename: 'cozy_nordic_wooden_cabin.jpg',
    url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'wooden cabin',
      category: 'architecture',
      attributes: ['timber logs', 'chimney smoke', 'forest backdrop', 'nordic retreat'],
      caption: 'A cozy rustic wooden cabin nestled peacefully amidst dense pine woods',
      confidence: 0.95
    }
  },

  // ==========================================
  // 5. CULINARY & GASTRONOMY
  // ==========================================
  {
    id: 'img-food-01',
    filename: 'artisan_espresso_latte_art.jpg',
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'artisan coffee',
      category: 'culinary',
      attributes: ['espresso cup', 'rosetta latte art', 'crema', 'cafe counter'],
      caption: 'A freshly poured cup of specialty espresso with intricate rosetta latte art',
      confidence: 0.98
    }
  },
  {
    id: 'img-food-02',
    filename: 'woodfired_neapolitan_pizza.jpg',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'neapolitan pizza',
      category: 'culinary',
      attributes: ['bubbling mozzarella', 'fresh basil', 'san marzano tomatoes', 'charred crust'],
      caption: 'An authentic Margherita Neapolitan woodfired pizza with melted buffalo mozzarella and basil',
      confidence: 0.99
    }
  },
  {
    id: 'img-food-03',
    filename: 'japanese_tonkotsu_ramen.jpg',
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'japanese ramen',
      category: 'culinary',
      attributes: ['pork chashu', 'ajitsuke tamago egg', 'steaming broth', 'nori seaweed', 'chopsticks'],
      caption: 'A steaming bowl of traditional Japanese tonkotsu ramen noodles with pork belly and soft boiled egg',
      confidence: 0.97
    }
  },

  // ==========================================
  // 6. DELIBERATE LOW-CONFIDENCE / AMBIGUOUS SAMPLES
  // (Required for Probe 1: Testing Low-Confidence Gating)
  // ==========================================
  {
    id: 'img-ambiguous-01',
    filename: 'blurry_silhouette_dense_fog.jpg',
    url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'unclear animal silhouette',
      category: 'ambiguous',
      attributes: ['heavy fog', 'motion blur', 'unidentifiable quadrupede', 'dark shadow'],
      caption: 'A dark, heavily blurred four-legged animal silhouette obscured by dense morning mist',
      confidence: 0.48 // Intentionally low confidence (<0.70)
    }
  },
  {
    id: 'img-ambiguous-02',
    filename: 'abstract_glare_lens_flare.jpg',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    width: 1920,
    height: 1080,
    ground_truth: {
      subject: 'abstract lens flare',
      category: 'abstract',
      attributes: ['overexposed glare', 'unfocused light circles', 'no clear subject'],
      caption: 'An overexposed abstract circular lens flare with no recognizable foreground object',
      confidence: 0.42 // Intentionally low confidence (<0.70)
    }
  }
];

module.exports = { IMAGE_CORPUS };
