import type { MaterialHit } from "@/types";
import { Table, Button, Tooltip } from "@heroui/react";
import { Copy, Check, Pencil, VectorPolygon, Trash } from "lucide-react";
import { currency } from "@/lib/currency";

export function MaterialeTable({
  searchResults,
  copiedField,
  handleCopyPrice,
  onEditStart,
  onDeleteStart,
}: {
  searchResults: MaterialHit[];
  copiedField: string | null;
  handleCopyPrice: (price: number, index: number, field: string) => void;
  onEditStart: (material: MaterialHit) => void;
  onDeleteStart: (material: MaterialHit) => void;
}) {
  const highlightText = (text: string, matchedWords: string[] | undefined) => {
    console.log("highlightText called with:", { text: text.substring(0, 50), matchedWords });
    if (!matchedWords || matchedWords.length === 0) {
      console.log("No matched words, returning text as-is");
      return text;
    }

    // Create a pattern that matches any of the matched words (case-insensitive)
    const pattern = new RegExp(`(${matchedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    console.log("Pattern:", pattern);

    const parts = text.split(pattern);
    console.log("Parts:", parts);

    return parts.map((part, index) => {
      if (matchedWords.some(w => w.toLowerCase() === part.toLowerCase())) {
        console.log("Highlighting:", part);
        return <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">{part}</mark>;
      }
      return part;
    });
  };

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Materiale" className="min-w-[600px]">
          <Table.Header>
                <Table.Column isRowHeader className="text-left">Descriere</Table.Column>
                <Table.Column className="text-center">Preț Achiziție</Table.Column>
                <Table.Column className="text-center">Preț Vânzare</Table.Column>
                <Table.Column className="text-center">Manoperă</Table.Column>
                {process.env.NODE_ENV === "development" && (
                  <Table.Column className="text-center">Embedding</Table.Column>
                )}
                <Table.Column className="text-center">Acțiuni</Table.Column>
            </Table.Header>
          <Table.Body>
            {searchResults.map((material, index) => (
              <Table.Row key={material.id}>
                <Table.Cell>
                  {highlightText(material.descriere, material.matchedWords)}
                </Table.Cell>
                <Table.Cell className="text-danger font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.pretAchizitie)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger-soft"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.pretAchizitie, index, "pretAchizitie")}
                      >
                        {copiedField === `${index}-pretAchizitie` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-accent font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.pretVanzare)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="secondary"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.pretVanzare, index, "pretVanzare")}
                      >
                        {copiedField === `${index}-pretVanzare` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-success font-semibold">
                  <div className="flex items-center gap-2 justify-end">
                    {currency.format(material.manopera)}
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="tertiary"
                        className="min-w-fit h-fit p-1"
                        onPress={() => handleCopyPrice(material.manopera, index, "manopera")}
                      >
                        {copiedField === `${index}-manopera` ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                      <Tooltip.Content>
                        <Tooltip.Arrow />
                        Copiază preț
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                </Table.Cell>
                {process.env.NODE_ENV === "development" && (
                  <Table.Cell className="text-muted font-semibold">
                    <div className="flex items-center gap-2 justify-center">
                      <Tooltip delay={0}>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          className="min-w-fit h-fit p-1 rounded-full"
                        >
                          <VectorPolygon className="size-4" />
                        </Button>
                        <Tooltip.Content>
                          <Tooltip.Arrow />
                          {material.embedding}
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                )}
                <Table.Cell className="flex flex-row items-center justify-end gap-2">
                  <Button 
                    isIconOnly
                    variant="primary" 
                    size="sm"
                    onPress={() => onEditStart(material)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button 
                    isIconOnly
                    variant="danger" 
                    size="sm"
                    onPress={() => onDeleteStart(material)}
                  >
                    <Trash className="size-4" />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
