const { pool } = require('../src/db/pool');

const categories = [
  {
    name: 'Bodas',
    slug: 'bodas',
    description: 'Invitaciones para bodas y celebraciones matrimoniales',
  },
  {
    name: 'Bautizos',
    slug: 'bautizos',
    description: 'Disenos para bautizos y primeras comuniones',
  },
  {
    name: 'Cumpleanos',
    slug: 'cumpleanos',
    description: 'Invitaciones para cumpleanos infantiles y adultos',
  },
];

const designs = [
  {
    name: 'Rosa Clasica',
    slug: 'rosa-clasica',
    categorySlug: 'bodas',
    description: 'Diseno romantico con tipografia serif y acentos florales.',
    basePrice: 48,
    personalizationPrice: 18,
    imageUrl: '/assets/designs/rosa-clasica.jpg',
    previewUrl: '/assets/designs/rosa-clasica-preview.jpg',
    tags: ['floral', 'elegante', 'romantico'],
    featured: true,
    stock: 120,
  },
  {
    name: 'Minimal Gold',
    slug: 'minimal-gold',
    categorySlug: 'bodas',
    description: 'Estilo minimalista con detalles dorados y fondos claros.',
    basePrice: 55,
    personalizationPrice: 20,
    imageUrl: '/assets/designs/minimal-gold.jpg',
    previewUrl: '/assets/designs/minimal-gold-preview.jpg',
    tags: ['minimal', 'premium', 'dorado'],
    featured: true,
    stock: 90,
  },
  {
    name: 'Luz de Bautizo',
    slug: 'luz-de-bautizo',
    categorySlug: 'bautizos',
    description: 'Plantilla suave para bautizo con iconografia religiosa sutil.',
    basePrice: 35,
    personalizationPrice: 12,
    imageUrl: '/assets/designs/luz-bautizo.jpg',
    previewUrl: '/assets/designs/luz-bautizo-preview.jpg',
    tags: ['bautizo', 'suave', 'familiar'],
    featured: false,
    stock: 140,
  },
  {
    name: 'Fiesta Neon',
    slug: 'fiesta-neon',
    categorySlug: 'cumpleanos',
    description: 'Diseno vibrante para cumpleanos juveniles y fiestas tematicas.',
    basePrice: 30,
    personalizationPrice: 10,
    imageUrl: '/assets/designs/fiesta-neon.jpg',
    previewUrl: '/assets/designs/fiesta-neon-preview.jpg',
    tags: ['moderno', 'neon', 'fiesta'],
    featured: true,
    stock: 160,
  },
  {
    name: 'Aventura Infantil',
    slug: 'aventura-infantil',
    categorySlug: 'cumpleanos',
    description: 'Ilustraciones ludicas para invitaciones infantiles.',
    basePrice: 28,
    personalizationPrice: 9,
    imageUrl: '/assets/designs/aventura-infantil.jpg',
    previewUrl: '/assets/designs/aventura-infantil-preview.jpg',
    tags: ['infantil', 'colorido', 'juego'],
    featured: false,
    stock: 180,
  },
];

async function upsertCategories(client) {
  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (name, slug, description, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (slug)
       DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = true, updated_at = NOW()`,
      [category.name, category.slug, category.description]
    );
  }
}

async function getCategoryIdMap(client) {
  const result = await client.query('SELECT id, slug FROM categories');
  return new Map(result.rows.map((row) => [row.slug, row.id]));
}

async function upsertDesignsAndInventory(client, categoryIdMap) {
  for (const design of designs) {
    const categoryId = categoryIdMap.get(design.categorySlug);
    if (!categoryId) {
      throw new Error(`Categoria no encontrada para slug: ${design.categorySlug}`);
    }

    const designResult = await client.query(
      `INSERT INTO designs (
         category_id, name, slug, description, base_price, personalization_price,
         image_url, preview_url, tags, featured, active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, true)
       ON CONFLICT (slug)
       DO UPDATE SET
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         base_price = EXCLUDED.base_price,
         personalization_price = EXCLUDED.personalization_price,
         image_url = EXCLUDED.image_url,
         preview_url = EXCLUDED.preview_url,
         tags = EXCLUDED.tags,
         featured = EXCLUDED.featured,
         active = true,
         updated_at = NOW()
       RETURNING id`,
      [
        categoryId,
        design.name,
        design.slug,
        design.description,
        design.basePrice,
        design.personalizationPrice,
        design.imageUrl,
        design.previewUrl,
        design.tags,
        design.featured,
      ]
    );

    const designId = designResult.rows[0].id;
    await client.query(
      `INSERT INTO inventory (design_id, stock, reserved)
       VALUES ($1, $2, 0)
       ON CONFLICT (design_id)
       DO UPDATE SET stock = EXCLUDED.stock, updated_at = NOW()`,
      [designId, design.stock]
    );
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsertCategories(client);
    const categoryIdMap = await getCategoryIdMap(client);
    await upsertDesignsAndInventory(client, categoryIdMap);
    await client.query('COMMIT');
    console.log('Seed completado: categorias, disenos e inventario inicial');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  const reason = error && (error.message || error.code || String(error));
  console.error('Fallo en seed:', reason);
  if (error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
