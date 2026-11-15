import { ProductCategory } from './types';

export interface SeedProduct {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  unit: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string;
  featured: boolean;
  active: boolean;
}

export const STUDIO_IMAGE_OPTIONS = [
  {
    label: 'Fresh Produce Basket',
    url: '/images/product_fresh_produce_1794745669309.jpg',
  },
  {
    label: 'Pantry Grains & Oils',
    url: '/images/product_pantry_staples_1794745669417.jpg',
  },
  {
    label: 'Artisan Bakery & Dairy',
    url: '/images/product_bakery_dairy_1794745669436.jpg',
  },
  {
    label: 'Chilled Ginger & Bissap',
    url: '/images/product_beverages_chilled_1794745669522.jpg',
  },
  {
    label: 'Cosmetics & Skincare',
    url: '/images/product_cosmetics_care_1794748953561.jpg',
  },
  {
    label: 'Drinks by Crate (24 Bottles)',
    url: '/images/product_drinks_crate_1794748953987.jpg',
  },
  {
    label: 'Water by Crate (Liters)',
    url: '/images/product_water_crate_1794748953924.jpg',
  },
];

export const INITIAL_FREETOWN_CATALOG: SeedProduct[] = [
  {
    id: 'prod_shea_body_lotion',
    sku: 'FS-COS-601',
    name: 'Nurture Natural Shea Butter Body Lotion',
    category: 'Cosmetics',
    description:
      'Deep-moisturizing West African shea butter body lotion with vanilla and oat extracts for smooth daily skin care.',
    unit: '250 ml pump bottle',
    price: 125,
    stockQuantity: 18,
    lowStockThreshold: 5,
    imageUrl: '/images/product_cosmetics_care_1794748953561.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_crate_ginger_citrus',
    sku: 'FS-DRK-701',
    name: 'Ginger Brew & Citrus Soda Crate (24 Bottles)',
    category: 'Drinks by Crate',
    description:
      'Full wooden retail crate of 24 chilled glass bottles featuring crisp ginger beer and sparkling citrus fruit sodas for events and homes.',
    unit: '1 crate (24 x 330 ml)',
    price: 310,
    stockQuantity: 15,
    lowStockThreshold: 4,
    imageUrl: '/images/product_drinks_crate_1794748953987.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_water_crate_18l',
    sku: 'FS-WAT-801',
    name: 'Guma Pure Spring Water Crate (18 Liters)',
    category: 'Water by Crate',
    description:
      'Full 18-liter drinking water crate containing twelve sealed 1.5-liter pure highland spring water bottles for family hydration.',
    unit: '1 crate (12 x 1.5 L · 18L)',
    price: 145,
    stockQuantity: 25,
    lowStockThreshold: 6,
    imageUrl: '/images/product_water_crate_1794748953924.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_water_crate_30l',
    sku: 'FS-WAT-802',
    name: 'Highland Pure Water Jumbo Crate (30 Liters)',
    category: 'Water by Crate',
    description:
      'Bulk 30-liter water crate packed with six heavy-duty 5-liter pure spring water jugs for kitchens, offices, and events.',
    unit: '1 crate (6 x 5 L · 30L)',
    price: 195,
    stockQuantity: 20,
    lowStockThreshold: 5,
    imageUrl: '/images/product_water_crate_1794748953924.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_glow_facial_oil',
    sku: 'FS-COS-602',
    name: 'Botanical Glow Facial Serum & Body Butter',
    category: 'Cosmetics',
    description:
      'Cold-pressed botanical facial oil dropper paired with whipped hydrating body butter for radiant, nourished skin.',
    unit: '200 ml jar + 30 ml oil',
    price: 165,
    stockQuantity: 12,
    lowStockThreshold: 4,
    imageUrl: '/images/product_cosmetics_care_1794748953561.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_whipped_cocoa_cream',
    sku: 'FS-COS-603',
    name: 'Cocoa Butter & Vitamin E Skin Cream',
    category: 'Cosmetics',
    description:
      'Rich cocoa butter beauty cream enriched with vitamin E and aloe vera to lock in moisture all day.',
    unit: '200 ml cosmetic jar',
    price: 98,
    stockQuantity: 22,
    lowStockThreshold: 6,
    imageUrl: '/images/product_cosmetics_care_1794748953561.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_crate_malt_cola',
    sku: 'FS-DRK-702',
    name: 'Classic Malt & Energy Drink Crate (24 Cans)',
    category: 'Drinks by Crate',
    description:
      'Wholesale full crate of 24 chilled non-alcoholic dark malt and sparkling cola cans packed for parties and store restocks.',
    unit: '1 crate (24 x 330 ml)',
    price: 340,
    stockQuantity: 14,
    lowStockThreshold: 4,
    imageUrl: '/images/product_drinks_crate_1794748953987.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_crate_tropical_juice',
    sku: 'FS-DRK-703',
    name: 'Tropical Mango & Pineapple Juice Crate (12 Liters)',
    category: 'Drinks by Crate',
    description:
      'Full 12-liter beverage crate containing twelve 1-liter pressed tropical fruit juice bottles ready to chill and serve.',
    unit: '1 crate (12 x 1 L)',
    price: 285,
    stockQuantity: 11,
    lowStockThreshold: 4,
    imageUrl: '/images/product_drinks_crate_1794748953987.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_water_crate_12l',
    sku: 'FS-WAT-803',
    name: 'Guma Table Water Event Crate (12 Liters)',
    category: 'Water by Crate',
    description:
      'Convenient 12-liter event crate with twenty-four 500 ml chilled pure spring water bottles for meetings and hospitality.',
    unit: '1 crate (24 x 500 ml · 12L)',
    price: 120,
    stockQuantity: 30,
    lowStockThreshold: 8,
    imageUrl: '/images/product_water_crate_1794748953924.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_bo_mangoes',
    sku: 'FS-PRO-101',
    name: 'Bo Valley Sweet Mangoes',
    category: 'Fresh Produce',
    description:
      'Tree-ripened Sierra Leonean mangoes harvested daily from Bo District orchards. Fragrant, fiber-light, and naturally sweet.',
    unit: '1.5 kg basket',
    price: 55,
    stockQuantity: 34,
    lowStockThreshold: 8,
    imageUrl: '/images/product_fresh_produce_1794745669309.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_ripe_plantains',
    sku: 'FS-PRO-102',
    name: 'Kambia Yellow & Green Plantains',
    category: 'Fresh Produce',
    description:
      'Firm cooking plantains selected for frying kelewele, boiling, or roasting. Fresh morning market delivery.',
    unit: '1.2 kg bunch',
    price: 42,
    stockQuantity: 48,
    lowStockThreshold: 10,
    imageUrl: '/images/product_fresh_produce_1794745669309.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_heirloom_okra_tomatoes',
    sku: 'FS-PRO-103',
    name: 'Vine Tomatoes & Tender Okra Mix',
    category: 'Fresh Produce',
    description:
      'Crisp garden okra pods paired with ripe vine tomatoes for stews, plasas, and Sunday jollof prep.',
    unit: '1 kg tray',
    price: 48,
    stockQuantity: 19,
    lowStockThreshold: 6,
    imageUrl: '/images/product_fresh_produce_1794745669309.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_parboiled_rice',
    sku: 'FS-PAN-201',
    name: 'Sierra Long-Grain Parboiled Rice',
    category: 'Pantry & Grains',
    description:
      'Cleanly milled, stone-free parboiled long-grain rice that cooks fluffy and separate for daily household meals.',
    unit: '5 kg linen sack',
    price: 195,
    stockQuantity: 42,
    lowStockThreshold: 10,
    imageUrl: '/images/product_pantry_staples_1794745669417.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_golden_cooking_oil',
    sku: 'FS-PAN-202',
    name: 'Golden Harvest Cold-Pressed Oil',
    category: 'Pantry & Grains',
    description:
      'Pure cold-pressed cooking oil bottled in heavy glass for clean high-heat frying and finishing dressings.',
    unit: '750 ml bottle',
    price: 110,
    stockQuantity: 26,
    lowStockThreshold: 6,
    imageUrl: '/images/product_pantry_staples_1794745669417.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_spice_duet',
    sku: 'FS-PAN-203',
    name: 'Kenema Ginger & Black Pepper Jars',
    category: 'Pantry & Grains',
    description:
      'Aromatic dried ground ginger and whole-cracked black pepper sealed in reusable ceramic pantry jars.',
    unit: '2 x 50 g set',
    price: 68,
    stockQuantity: 7,
    lowStockThreshold: 8,
    imageUrl: '/images/product_pantry_staples_1794745669417.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_country_sourdough',
    sku: 'FS-BAK-301',
    name: 'Freetown Bakehouse Country Loaf',
    category: 'Bakery & Dairy',
    description:
      'Slow-fermented hearth sourdough baked at 5 AM daily with a crisp caramelized crust and tender crumb.',
    unit: '700 g loaf',
    price: 45,
    stockQuantity: 15,
    lowStockThreshold: 5,
    imageUrl: '/images/product_bakery_dairy_1794745669436.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_farm_eggs',
    sku: 'FS-BAK-302',
    name: 'Waterloo Free-Range Brown Eggs',
    category: 'Bakery & Dairy',
    description:
      'Rich golden-yolk farm eggs collected daily from free-range Waterloo poultry farms and packed in recycled pulp.',
    unit: '12 eggs',
    price: 58,
    stockQuantity: 30,
    lowStockThreshold: 8,
    imageUrl: '/images/product_bakery_dairy_1794745669436.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_whole_milk',
    sku: 'FS-BAK-303',
    name: 'Chilled Whole Dairy Milk',
    category: 'Bakery & Dairy',
    description:
      'Pasteurized full-cream milk delivered chilled in returnable glass bottles for tea, porridge, and baking.',
    unit: '750 ml glass',
    price: 52,
    stockQuantity: 22,
    lowStockThreshold: 6,
    imageUrl: '/images/product_bakery_dairy_1794745669436.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_craft_ginger_beer',
    sku: 'FS-BEV-401',
    name: 'Steeped Roots Fiery Ginger Beer',
    category: 'Chilled & Beverages',
    description:
      'Small-batch cold-brewed Sierra Leone ginger beer with fresh lime zest and zero artificial sweeteners.',
    unit: '4 x 330 ml pack',
    price: 88,
    stockQuantity: 28,
    lowStockThreshold: 8,
    imageUrl: '/images/product_beverages_chilled_1794745669522.jpg',
    featured: true,
    active: true,
  },
  {
    id: 'prod_hibiscus_bissap',
    sku: 'FS-BEV-402',
    name: 'Pressed Hibiscus Bissap Carafe',
    category: 'Chilled & Beverages',
    description:
      'Deep ruby sorrel hibiscus infusion lightly sweetened with cane sugar and spiced with cloves and mint.',
    unit: '1 L carafe',
    price: 62,
    stockQuantity: 16,
    lowStockThreshold: 5,
    imageUrl: '/images/product_beverages_chilled_1794745669522.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_sparkling_water',
    sku: 'FS-BEV-403',
    name: 'Guma Highland Sparkling Water',
    category: 'Chilled & Beverages',
    description:
      'Crisp naturally carbonated highland spring water bottled in glass for dining tables and hydration.',
    unit: '6 x 500 ml case',
    price: 94,
    stockQuantity: 20,
    lowStockThreshold: 6,
    imageUrl: '/images/product_beverages_chilled_1794745669522.jpg',
    featured: false,
    active: true,
  },
  {
    id: 'prod_shea_hand_wash',
    sku: 'FS-HHC-501',
    name: 'Pure Shea & Lemongrass Kitchen Soap',
    category: 'Household & Care',
    description:
      'Plant-based liquid kitchen and hand soap crafted with cold-pressed shea butter and fresh lemongrass oil.',
    unit: '500 ml dispenser',
    price: 65,
    stockQuantity: 24,
    lowStockThreshold: 6,
    imageUrl: '/images/product_pantry_staples_1794745669417.jpg',
    featured: false,
    active: true,
  },
];

export function formatLeones(amount: number): string {
  return `NLe ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
