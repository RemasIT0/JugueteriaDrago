/**
 * Datos base. Las categorías se cargan siempre (son la configuración inicial, editable).
 * El resto son DATOS DE EJEMPLO que solo se cargan si el dueño lo elige en la configuración
 * inicial; ningún proveedor ni producto de aquí es real (los proveedores dicen "(ejemplo)").
 */
import type { Category, Product, Supplier } from '@/types'

export const seedCategories: Category[] = [
  { id: 'cat_munecas', name: 'Muñecas', color: 'coral', defaults: { ageMin: 3, batteries: false, minStock: 5 } },
  { id: 'cat_bloques', name: 'Bloques', color: 'turquesa', defaults: { ageMin: 4, batteries: false, minStock: 6 } },
  { id: 'cat_peluches', name: 'Peluches', color: 'lila', defaults: { ageMin: 0, batteries: false, minStock: 8 } },
  { id: 'cat_mesa', name: 'Juegos de mesa', color: 'sol', defaults: { ageMin: 5, batteries: false, minStock: 4 } },
  { id: 'cat_vehiculos', name: 'Vehículos', color: 'cielo', defaults: { ageMin: 3, batteries: true, minStock: 5 } },
  { id: 'cat_aire', name: 'Aire libre', color: 'hoja', defaults: { ageMin: 6, batteries: false, minStock: 3 } },
]

export const seedSuppliers: Supplier[] = [
  { id: 'sup_andina', name: 'Distribuidora Andina (ejemplo)', contact: 'Lucía Paredes', phone: '+00 000 0001', email: 'ventas@andina.example' },
  { id: 'sup_ludica', name: 'Lúdica Importaciones (ejemplo)', contact: 'Martín Rojas', phone: '+00 000 0002', email: 'pedidos@ludica.example' },
  { id: 'sup_osito', name: 'Taller El Osito (ejemplo)', contact: 'Ana Quispe', phone: '+00 000 0003', email: 'hola@osito.example' },
]

type Row = [name: string, cat: string, sup: string, price: number, stock: number, brand: string]

const rows: Row[] = [
  ['Muñeca Doctora con accesorios', 'cat_munecas', 'sup_ludica', 59.9, 30, 'Lúdica'],
  ['Casa de muñecas de madera 3 pisos', 'cat_munecas', 'sup_osito', 210, 3, 'El Osito'],
  ['Muñeca Bailarina 30 cm', 'cat_munecas', 'sup_ludica', 42.5, 11, 'Lúdica'],
  ['Bebé Recién Nacido con biberón', 'cat_munecas', 'sup_andina', 64, 7, 'Andina Kids'],
  ['Set Cocinita para muñecas', 'cat_munecas', 'sup_andina', 38, 16, 'Andina Kids'],
  ['Bloques Ciudad 250 piezas', 'cat_bloques', 'sup_ludica', 89, 12, 'Constructa'],
  ['Torre Apilable Arcoíris', 'cat_bloques', 'sup_osito', 34, 22, 'El Osito'],
  ['Bloques Magnéticos 60 piezas', 'cat_bloques', 'sup_andina', 119, 5, 'Magnetix'],
  ['Tren de Madera con vías', 'cat_bloques', 'sup_osito', 72, 9, 'El Osito'],
  ['Bloques Gigantes Bebé 40 pzs', 'cat_bloques', 'sup_ludica', 55, 26, 'Constructa'],
  ['Castillo Medieval 480 piezas', 'cat_bloques', 'sup_ludica', 149, 4, 'Constructa'],
  ['Peluche Dragón 30 cm', 'cat_peluches', 'sup_osito', 45, 4, 'El Osito'],
  ['Osito Miel 25 cm', 'cat_peluches', 'sup_osito', 29.9, 41, 'El Osito'],
  ['Unicornio Pastel 40 cm', 'cat_peluches', 'sup_andina', 52, 14, 'Andina Kids'],
  ['Perrito Salchicha 50 cm', 'cat_peluches', 'sup_andina', 39, 19, 'Andina Kids'],
  ['Pingüino de bolsillo', 'cat_peluches', 'sup_osito', 12.5, 64, 'El Osito'],
  ['Rompecabezas Selva 500 piezas', 'cat_mesa', 'sup_ludica', 39.9, 24, 'Ingenio'],
  ['Juego de Memoria Animales', 'cat_mesa', 'sup_ludica', 24.5, 18, 'Ingenio'],
  ['Dominó Clásico de madera', 'cat_mesa', 'sup_osito', 19.9, 15, 'El Osito'],
  ['Escalera y Serpientes', 'cat_mesa', 'sup_andina', 22, 2, 'Andina Kids'],
  ['Ajedrez Escolar', 'cat_mesa', 'sup_ludica', 35, 10, 'Ingenio'],
  ['Juego de Preguntas Familiar', 'cat_mesa', 'sup_ludica', 68, 8, 'Ingenio'],
  ['Auto a control remoto Rally', 'cat_vehiculos', 'sup_andina', 129, 6, 'Turbo'],
  ['Camión de Bomberos con luces', 'cat_vehiculos', 'sup_andina', 79, 13, 'Turbo'],
  ['Set 5 autitos de metal', 'cat_vehiculos', 'sup_ludica', 27, 33, 'Turbo'],
  ['Helicóptero de rescate', 'cat_vehiculos', 'sup_andina', 58, 2, 'Turbo'],
  ['Pista de carreras en 8', 'cat_vehiculos', 'sup_ludica', 99, 7, 'Turbo'],
  ['Pelota de playa 60 cm', 'cat_aire', 'sup_andina', 9.9, 48, 'Sol y Mar'],
  ['Cometa Dragón Rojo', 'cat_aire', 'sup_osito', 26, 9, 'El Osito'],
  ['Set de burbujas gigantes', 'cat_aire', 'sup_andina', 15, 1, 'Sol y Mar'],
  ['Patineta infantil', 'cat_aire', 'sup_ludica', 110, 5, 'Ruedas'],
  ['Baldecito de arena con moldes', 'cat_aire', 'sup_andina', 18, 21, 'Sol y Mar'],
]

/** Temporadas de ejemplo por categoría. */
const SEASON_OF: Record<string, string[]> = {
  cat_munecas: ['temp_navidad', 'temp_infancias'],
  cat_bloques: ['temp_navidad', 'temp_reyes'],
  cat_peluches: ['temp_navidad'],
  cat_mesa: ['temp_reyes', 'temp_infancias'],
  cat_vehiculos: ['temp_infancias'],
}

const DAY = 86_400_000
const now = Date.now()

export const seedProducts: Product[] = rows.map(([name, categoryId, supplierId, price, stock, brand], i) => {
  const cat = seedCategories.find((c) => c.id === categoryId)!
  const created = new Date(now - (rows.length - i) * DAY * 1.7).toISOString()
  return {
    id: `prd_seed_${i + 1}`,
    sku: `775012300${String(4100 + i).padStart(4, '0')}`,
    name,
    categoryId,
    supplierId,
    // Precios en pesos argentinos (de ejemplo): costo ≈ 55 % del precio de venta.
    price: Math.round((price * 1000) / 100) * 100,
    cost: Math.round((price * 550) / 100) * 100,
    seasons: SEASON_OF[categoryId] ?? [],
    stock,
    minStock: cat.defaults.minStock ?? 5,
    ageMin: cat.defaults.ageMin ?? 3,
    batteries: cat.defaults.batteries ?? false,
    brand,
    photos: [],
    loteId: null,
    createdAt: created,
    updatedAt: created,
  }
})
