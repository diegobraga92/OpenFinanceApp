import * as React from 'react';
import { ImagePlus, QrCode, ReceiptText, ScanLine, Save, Trash2 } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useToast } from '@/components/ui/toaster';
import {
  fetchPriceHistory,
  fetchReceipts,
  mergeProducts,
  saveReceipt,
  scanReceipt,
  scanReceiptOcr,
  type SaveReceiptRequest,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ParsedItem {
  description?: string;
  quantity?: string | null;
  unit_price?: string | null;
  total_price?: string | null;
}

interface ParsedReceipt {
  access_key?: string;
  total?: string;
  icms?: string;
  date?: string;
  cnpj?: string | null;
  store_name?: string;
  version?: string;
  items?: ParsedItem[];
}

interface EditableItem {
  description: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  total_price: string | number;
  normalized_product_id: string | null;
}

interface GalleryReceipt {
  id?: string;
  store_name?: string | null;
  total?: string | null;
  date?: string | null;
}

interface PricePoint {
  receipt_date: string | null;
  store_name: string | null;
  unit_price: string | number | null;
  description: string;
}

export function ReceiptsPage() {
  const { t, formatMoney, formatDate } = useI18n();
  const { toast } = useToast();

  const [qrData, setQrData] = React.useState('');
  const [parsed, setParsed] = React.useState<ParsedReceipt | null>(null);
  const [reviewItems, setReviewItems] = React.useState<EditableItem[]>([]);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [gallery, setGallery] = React.useState<GalleryReceipt[]>([]);
  const [itemsByReceipt, setItemsByReceipt] = React.useState<ReceiptItem[]>([]);
  const [priceHistory, setPriceHistory] = React.useState<PricePoint[] | null>(null);
  const [selectedProduct, setSelectedProduct] = React.useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = React.useState('');
  const [mergeSource, setMergeSource] = React.useState('');
  const [merging, setMerging] = React.useState(false);

  const loadGallery = React.useCallback(async () => {
    try {
      const res = await fetchReceipts();
      setGallery((res.items as GalleryReceipt[]) ?? []);
      const items = (res as unknown as { items_by_receipt?: ReceiptItem[] }).items_by_receipt;
      setItemsByReceipt(items ?? []);
    } catch {
      // Non-critical.
    }
  }, []);

  React.useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const products = itemsByReceipt.filter((i) => i.normalized_product_id);

  const applyParsedReceipt = (res: Record<string, unknown>) => {
    const p = res as unknown as ParsedReceipt;
    setParsed(p);
    setReviewItems(
      (p.items ?? []).map((item) => ({
        description: item.description ?? '',
        quantity: item.quantity ?? '1',
        unit_price: item.unit_price ?? '',
        total_price: item.total_price ?? '',
      })),
    );
  };


  const handleScanQr = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scanReceipt(qrData.trim());
      applyParsedReceipt(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receipts.failedParseQr'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleOcr = async () => {
    if (!selectedImage) return;
    setOcrLoading(true);
    setError(null);
    try {
      // Lazy-load tesseract.js so the initial bundle stays small.
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(selectedImage, 'por', { logger: () => {} });
      const rawText = result.data.text;
      if (!rawText.trim()) {
        setError(t('receipts.ocrNoText'));
        return;
      }
      const res = await scanReceiptOcr(rawText);
      applyParsedReceipt(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receipts.ocrFailed'));
    } finally {
      setOcrLoading(false);
    }
  };

  const updateReviewItem = (index: number, field: keyof EditableItem, value: string) => {
    setReviewItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addReviewItem = () => {
    setReviewItems((prev) => [...prev, { description: '', quantity: '1', unit_price: '', total_price: '' }]);
  };

  const removeReviewItem = (index: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveReceipt = async () => {
    if (!parsed) return;
    const payload: SaveReceiptRequest = {
      store_name: parsed.store_name ?? t('receipts.unknownStore'),
      total: parsed.total ?? '0',
      date: parsed.date ?? new Date().toISOString().slice(0, 10),
      cnpj: parsed.cnpj ?? null,
      items: reviewItems
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity || '1',
          unit_price: item.unit_price || undefined,
          total_price: item.total_price || undefined,
        })),
    };
    setLoading(true);
    setError(null);
    try {
      const res = await saveReceipt(payload);
      toast({
        title: t('receipts.saved', { id: res.id.slice(0, 8) }),
        variant: 'success',
      });
      setParsed(null);
      setReviewItems([]);
      setQrData('');
      setSelectedImage(null);
      await loadGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receipts.failedSave'));
    } finally {
      setLoading(false);
    }
  };

  const showPriceHistory = async (productId: string, label: string) => {
    setSelectedProduct(label);
    setPriceHistory(null);
    try {
      const res = await fetchPriceHistory(productId);
      setPriceHistory(res.points as PricePoint[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receipts.failedPriceHistory'));
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget || !mergeSource || mergeTarget === mergeSource) {
      setError(t('receipts.pickTwo'));
      return;
    }
    setMerging(true);
    setError(null);
    try {
      const res = await mergeProducts({ target_id: mergeTarget, source_id: mergeSource });
      toast({
        title: t('receipts.merged', { status: res.status }),
        variant: 'success',
      });
      setMergeTarget('');
      setMergeSource('');
      await loadGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('receipts.failedMerge'));
    } finally {
      setMerging(false);
    }
  };

  const uniqueProducts = Array.from(
    new Map(products.map((p) => [p.normalized_product_id, p])).values(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.receipts')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('receipts.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Scan / OCR */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              {t('receipts.scanQr')}
            </CardTitle>
            <CardDescription>{t('receipts.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qr-data">{t('receipts.qrData')}</Label>
              <Input
                id="qr-data"
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                placeholder={t('receipts.qrPlaceholder')}
                spellCheck={false}
              />
            </div>
            <Button onClick={() => void handleScanQr()} disabled={loading || !qrData.trim()}>
              <ScanLine className="h-4 w-4" />
              {loading ? t('common.loading') : t('receipts.scanQrButton')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              {t('receipts.ocrTitle')}
            </CardTitle>
            <CardDescription>{t('receipts.ocrHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ocr-file">{t('receipts.readReceipt')}</Label>
              <Input id="ocr-file" type="file" accept="image/*" onChange={handleImageChange} />
            </div>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Receipt preview"
                className="max-h-40 rounded-md border border-border object-contain"
              />
            )}
            <Button onClick={() => void handleOcr()} disabled={ocrLoading || !selectedImage}>
              {ocrLoading ? t('receipts.reading') : t('receipts.readReceipt')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Parsed receipt preview + editable items */}
      {parsed && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              {t('receipts.parsedTitle')}
            </CardTitle>
            <CardDescription>
              {parsed.store_name ?? t('receipts.unknownStore')}
              {parsed.date ? ` · ${formatDate(parsed.date)}` : ''}
              {parsed.total ? ` · ${t('receipts.total')}: ${formatMoney(parsed.total)}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {reviewItems.map((item, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[160px] flex-1"
                    value={item.description}
                    onChange={(e) => updateReviewItem(index, 'description', e.target.value)}
                    placeholder={t('common.description')}
                  />
                  <Input
                    className="w-16"
                    value={item.quantity}
                    onChange={(e) => updateReviewItem(index, 'quantity', e.target.value)}
                    placeholder={t('receipts.quantity')}
                  />
                  <Input
                    className="w-24"
                    value={item.unit_price}
                    onChange={(e) => updateReviewItem(index, 'unit_price', e.target.value)}
                    placeholder={t('receipts.unit')}
                  />
                  <Input
                    className="w-24"
                    value={item.total_price}
                    onChange={(e) => updateReviewItem(index, 'total_price', e.target.value)}
                    placeholder={t('receipts.total')}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeReviewItem(index)}
                    aria-label={t('receipts.removeItem')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addReviewItem}>
                {t('receipts.addItem')}
              </Button>
            </div>
            <Button onClick={() => void handleSaveReceipt()} disabled={loading}>
              <Save className="h-4 w-4" />
              {loading ? t('common.saving') : t('receipts.saveReceipt')}
            </Button>
          </CardContent>
        </Card>
      )}


      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>{t('receipts.gallery')}</CardTitle>
          <CardDescription>
            {gallery.length > 0 ? `${gallery.length} ${t('common.entries')}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gallery.length === 0 ? (
            <p className="py-8 text-center text-sm text-dim">{t('receipts.noReceipts')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((receipt, i) => (
                <div key={receipt.id ?? i} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="truncate text-sm font-medium">
                    {receipt.store_name ?? t('receipts.unknownStore')}
                  </p>
                  <p className="text-xs text-dim">
                    {receipt.date ? formatDate(receipt.date) : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold tabular-nums">
                    {formatMoney(receipt.total ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products + price history */}
      {uniqueProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('receipts.products')}</CardTitle>
            <CardDescription>{t('receipts.productHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {uniqueProducts.map((p) => (
                <button
                  key={p.normalized_product_id}
                  type="button"
                  onClick={() => showPriceHistory(p.normalized_product_id!, p.description)}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {p.description}
                </button>
              ))}
            </div>

            {priceHistory && (
              <div>
                <p className="mb-2 text-sm font-medium">
                  {t('receipts.priceHistory', { product: selectedProduct ?? '' })}
                </p>
                {priceHistory.length === 0 ? (
                  <p className="text-sm text-dim">{t('receipts.noPriceHistory')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {priceHistory.map((point, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground">
                          {point.receipt_date ? formatDate(point.receipt_date) : ''}
                          {point.store_name ? ` · ${point.store_name}` : ''}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatMoney(point.unit_price ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Merge */}
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium">{t('receipts.mergeTitle')}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="merge-target">{t('receipts.mergeTarget')}</Label>
                  <select
                    id="merge-target"
                    className="flex h-9 w-44 rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                  >
                    <option value="">—</option>
                    {uniqueProducts.map((p) => (
                      <option key={p.normalized_product_id} value={p.normalized_product_id!}>
                        {p.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="merge-source">{t('receipts.mergeSource')}</Label>
                  <select
                    id="merge-source"
                    className="flex h-9 w-44 rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={mergeSource}
                    onChange={(e) => setMergeSource(e.target.value)}
                  >
                    <option value="">—</option>
                    {uniqueProducts.map((p) => (
                      <option key={p.normalized_product_id} value={p.normalized_product_id!}>
                        {p.description}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => void handleMerge()} disabled={merging}>
                  {merging ? t('common.loading') : t('receipts.merge')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

