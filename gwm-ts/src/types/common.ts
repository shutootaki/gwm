// 共通型定義

export interface SelectItem {
  label: string;
  value: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
