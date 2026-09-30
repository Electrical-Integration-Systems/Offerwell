
import type { MaterialHit } from "@/types";
import { Button, Card, Tooltip } from "@heroui/react";
import { Copy, Check } from "lucide-react";
import { currency } from "@/lib/currency";

export function MaterialeCards({
  searchResults,
  copiedField,
  handleCopyPrice,
}: {
  searchResults: MaterialHit[];
  copiedField: string | null;
  handleCopyPrice: (price: number, index: number, field: string) => void;
}) {
  return (
    <div className="space-y-2">
        {searchResults.map((material, index) => (
        <Card key={index} className="rounded-4xl bg-surface p-0 shadow-none px-5 hover:shadow-md">
            <Card.Content className="gap-5 p-5 sm:p-6">
            <div className="flex items-center justify-between">
                <h3 className="break-words text-base font-semibold">{material.descriere}</h3>
                <div className="flex flex-row gap-2">
                <Button 
                    variant="primary" 
                    size="sm" 
                    className="gap-2"
                >
                    Edit
                </Button>
                <Button 
                    variant="danger" 
                    size="sm" 
                    className="gap-2"
                >
                    Delete
                </Button>
                </div>
            </div>
            <dl className="flex flex-row gap-3 items-center justify-around border-t border-border pt-4">
                {([
                ["Preț achiziție", material.pretAchizitie, "text-danger", "pretAchizitie"],
                ["Preț vânzare", material.pretVanzare, "text-accent", "pretVanzare"],
                ["Manoperă", material.manopera, "text-success", "manopera"],
                ] as const).map(([label, price, color, field]) => (
                <div key={label} className="min-w-0">
                    <dt className="mb-1 text-sm text-muted">{label}</dt>
                    <div className="flex items-center gap-2">
                      <dd className={`break-words text-lg font-semibold tabular-nums ${color}`}>{currency.format(price)}</dd>
                      <Tooltip delay={0}>
                        <Button
                          isIconOnly
                          size="sm"
                          className="min-w-fit h-fit p-1"
                          onPress={() => handleCopyPrice(price, index, field)}
                        >
                          {copiedField === `${index}-${field}` ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </Button>
                        <Tooltip.Content>
                          <Tooltip.Arrow />
                          Copiază preț
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                </div>
                ))}
            </dl>
            </Card.Content>
        </Card>
        ))}
    </div>
  );
}
