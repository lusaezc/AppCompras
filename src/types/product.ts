export type Product = {
  id: string;
  code: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  brandId?: number | null;
  categoryId?: number | null;
  image?: string; // 👈 base64
  createdAt?: string;
};
