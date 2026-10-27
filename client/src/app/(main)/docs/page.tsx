import type { Metadata } from "next";
import type { ReactNode } from "react";
import ScrollToTop from "./scroll-to-top";
import { BookOpen, Check, Copy, Database, Eye, Lightbulb, Pencil, Replace, Search, Undo2, Upload, type LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Ghid de utilizare",
  description: "Cum verifici materialele, configurezi multiplicatorul de vânzare, actualizezi catalogul și exporți o ofertă în Offerwell.",
};

const chapters = [
  { id: "prima-oferta", title: "Prima ofertă, pas cu pas" },
  { id: "pregatire-excel", title: "Pregătirea fișierului Excel" },
  { id: "validare", title: "Verificarea materialelor" },
  { id: "preturi-export", title: "Prețuri, monedă și export" },
  { id: "oferte", title: "Reluarea unei oferte" },
  { id: "catalog", title: "Căutarea în catalog" },
  { id: "materiale", title: "Adăugarea și importul materialelor" },
  { id: "intrebari", title: "Întrebări frecvente" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 border-t border-border pt-8">
      <h2 id={`${id}-title`} className="mb-5 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-5 leading-relaxed">{children}</div>
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <aside className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <Lightbulb className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="text-sm leading-relaxed"><p className="mb-1 font-semibold">Sfat practic</p>{children}</div>
    </aside>
  );
}

function Control({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-4">
      <span className="rounded-lg bg-secondary p-2"><Icon className="size-4" aria-hidden="true" /></span>
      <div><h3 className="mb-1 font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{children}</p></div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="mb-10 max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-accent"><BookOpen className="size-4" aria-hidden="true" />Ghid de utilizare</p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">De la lista de cantități la oferta finală</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">Offerwell te ajută să găsești prețuri pentru materialele dintr-un Excel, să verifici propunerile și să descarci oferta completată. Tu verifici dacă materialele și valorile sunt potrivite pentru lucrarea ofertată.</p>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Cuprinsul ghidului" className="rounded-xl border border-border p-5 lg:sticky lg:top-24">
          <p className="mb-3 text-sm font-semibold">În acest ghid</p>
          <ol className="space-y-1">
            {chapters.map(({ id, title }, index) => (
              <li key={id}><a href={`#${id}`} className="flex gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"><span className="tabular-nums text-accent">{index + 1}.</span>{title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 space-y-10">
          <Section id="prima-oferta" title="1. Prima ofertă, pas cu pas">
            <ol className="space-y-4">
              {[
                ["Deschide Generare AI", "Poți începe și din Oferte, folosind butonul Adaugă."],
                ["Alege lista de cantități", "Apasă pe zona de încărcare sau trage fișierul Excel peste ea. Verifică numele afișat. Dacă ai ales alt fișier, apasă Elimină și selectează-l pe cel corect."],
                ["Apasă Analizează Excel", "Aplicația parcurge încărcarea, analiza, extragerea materialelor și căutarea prețurilor. Urmărește etapele afișate și așteaptă apariția tabelului Materiale și prețuri."],
                ["Verifică materialele și prețurile", "Compară descrierile, cantitățile, unitățile de măsură și prețurile. Rezolvă rândurile marcate De validat."],
                ["Generează și descarcă Excelul", "Folosește Generează Excel, apoi Descarcă din bara de deasupra materialelor. Dacă mai există rânduri nevalidate, aplicația cere confirmare înainte de export. Deschide fișierul și verifică-l înainte de a-l trimite."],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">{index + 1}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></li>
              ))}
            </ol>
            <Tip><p>La prima ofertă, lucrează cu o listă scurtă. Vei putea compara rapid câteva rânduri cu Excelul original și vei înțelege mai ușor cum funcționează validarea.</p></Tip>
          </Section>

          <Section id="pregatire-excel" title="2. Pregătirea fișierului Excel">
            <p>Folosește un fișier <strong>.xlsx</strong> de maximum <strong>10 MB</strong>, cu cel mult <strong>2.000 de materiale</strong> în total. Dacă fișierul are mai multe foi, selectează înainte de analiză foile care conțin materiale și cantități. Aplicația analizează separat structura fiecărei foi selectate.</p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Folosește coloane clare pentru descriere, cantitate și unitate de măsură, de exemplu: „Cablu 3×2,5 mm²”, „100”, „m”.</li>
              <li>Păstrează specificațiile care diferențiază materialele: dimensiune, secțiune, diametru, tip sau mod de montaj.</li>
              <li>Verifică valorile cantităților și unitățile de măsură. Dacă unitatea lipsește, aplicația folosește „buc”; corectează sursa dacă materialul se măsoară în metri sau în altă unitate.</li>
              <li>Indică limpede moneda în document, astfel încât oferta să poată fi completată în moneda potrivită.</li>
              <li>Pentru o ofertă nouă, pornește de la lista de cantități originală, fără coloanele de preț adăugate de un export anterior.</li>
            </ul>
            <Tip><p>Dacă un material este măsurat în metri, prețul trebuie să fie pe metru. O cantitate corectă combinată cu un preț pentru altă unitate poate schimba mult totalul.</p></Tip>
            <h3 className="text-lg font-semibold">Dacă analiza nu identifică bine coloanele</h3>
            <p>Dacă analiza sau extragerea materialelor eșuează, apare formularul <strong>Selectează manual structura Excelului</strong>. Îl poți deschide și cu <strong>Corectează structura Excelului</strong> când observi că au fost citite alte date decât cele dorite.</p>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Deschide Excelul separat și verifică foaia selectată în aplicație. Dacă ai ales mai multe foi, folosește selectorul de foi pentru a alege foaia a cărei structură vrei să o corectezi. În oferta procesată, selectorul și creionul pentru corectarea structurii sunt în bara de deasupra materialelor.</li>
              <li>Introdu numărul rândului unde se află primul material, fără antet. De exemplu, dacă titlurile sunt pe rândul 6 și materialele încep pe 7, introdu 7.</li>
              <li>Introdu literele coloanelor cu descrierea, cantitatea și unitatea de măsură. Uită-te la conținut: o coloană numită „Id Articol” poate conține chiar descrierea completă a materialului.</li>
              <li>Completează ultima coloană a tabelului și moneda în care dorești oferta finală, RON sau EUR.</li>
              <li>Apasă <strong className="text-foreground">Salvează structura și continuă</strong> dacă ai schimbat datele de extragere. Dacă ai modificat doar ultima coloană sau moneda, apasă <strong className="text-foreground">Salvează setările de export</strong>, apoi generează din nou Excelul.</li>
            </ol>
            <p className="text-sm text-muted-foreground">Valorile găsite anterior sunt precompletate când există. Schimbarea coloanei de descriere, cantitate, unitate sau a primului rând reface extragerea și înlocuiește validările. Modificarea ultimei coloane ori a monedei afectează doar exportul: materialele, prețurile și validările sunt păstrate. În cele șase coloane de preț adăugate, textul de achiziție este roșu, cel de vânzare verde, iar manopera este neagră. Aceste coloane nu au fundal colorat sau borduri; coloana Total final nu este inclusă în Excel.</p>
          </Section>

          <Section id="validare" title="3. Verificarea materialelor">
            <p>În tabel vezi descrierea din Excel și prețurile propuse pentru fiecare rând. Numărul <strong>Rând</strong> te ajută să găsești poziția în fișierul original.</p>
            <h3 className="text-lg font-semibold">Bara de instrumente a ofertei</h3>
            <p>În pagina de detalii, setările sunt grupate într-o bară compactă deasupra listei. <strong>Prețuri</strong> și <strong>Validare multiplă</strong> deschid panouri doar când ai nevoie de ele, astfel încât tabelul să rămână la vedere. Numărul de materiale, numărul celor de validat și totalul sunt afișate deasupra barei.</p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Nevalidate:</strong> activează sau dezactivează filtrul pentru rândurile care cer verificare.</li>
              <li><strong className="text-foreground">Prețuri:</strong> configurează multiplicatorul de vânzare pentru toate materialele ofertei.</li>
              <li><strong className="text-foreground">Validare multiplă:</strong> verifică și confirmă materialele după un prag de calitate. Opțiunea apare când există materiale de validat.</li>
              <li><strong className="text-foreground">EUR / RON:</strong> alege moneda afișată în tabel, în total și în panoul de editare.</li>
              <li><strong className="text-foreground">Export și alte acțiuni:</strong> generează sau descarcă Excelul, corectează structura cu creionul ori reia complet procesarea cu săgeata circulară. Ține cursorul peste pictograme pentru denumirea acțiunii.</li>
            </ul>
            <p>Dacă ai selectat mai multe foi, folosește <strong>selectorul de foi</strong> pentru a comuta între materialele lor. Coloana <strong>Total vânzare + manoperă</strong> arată cantitatea înmulțită cu suma prețului de vânzare și a manoperei. Totalul ofertei și numărul de materiale de validat sunt pentru întreaga ofertă. Excelul final include prețurile în fiecare foaie selectată.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Control icon={Eye} title="Ochiul: vezi materialul găsit">Ține cursorul peste ochiul de lângă descriere. Apare descrierea materialului găsit în catalog, folosit ca referință pentru prețurile propuse. Compar-o cu cerința din Excel înainte de a confirma.</Control>
              <Control icon={Pencil} title="Creionul: corectează valorile">Deschide panoul Corectare material. Poți modifica multiplicatorul de vânzare, cantitatea, prețul de achiziție, prețul de vânzare și manopera. Apasă Salvează și validează pentru a păstra modificările și a confirma rândul.</Control>
              <Control icon={Check} title="Bifa: confirmă rândul">Dacă materialul și valorile sunt potrivite, apasă bifa din Acțiuni. Folosește-o pentru rândurile De validat care nu au nevoie de corecturi.</Control>
              <Control icon={Undo2} title="Anulează validarea">Pe un rând validat, săgeata de anulare apare în locul bifei. Confirmă acțiunea pentru a trimite materialul din nou la verificare. Prețurile se păstrează, iar Excelul trebuie generat din nou.</Control>
              <Control icon={Replace} title="Schimbă materialul asociat">Caută și selectează o altă referință din catalog. Rândul primește noile prețuri și necesită din nou validare. Dacă are un multiplicator configurat, acesta se păstrează la calcularea vânzării.</Control>
              <Control icon={Database} title="Salvează în catalog">Pentru un rând validat, poți actualiza prețurile materialului asociat sau adăuga un material nou. Verifică valorile în EUR și confirmă operația în dialog.</Control>
              <Control icon={Search} title="Cuvintele evidențiate">Cuvintele marcate în descriere arată termenii comuni cu materialul găsit. Verifică separat numerele, dimensiunile și specificațiile care contează pentru lucrare.</Control>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[440px] text-left text-sm">
                <caption className="sr-only">Semnificația stărilor de validare</caption>
                <thead className="bg-secondary"><tr><th scope="col" className="px-4 py-3">Stare</th><th scope="col" className="px-4 py-3">Ce ai de făcut</th></tr></thead>
                <tbody className="divide-y divide-border">
                  <tr><th scope="row" className="px-4 py-3 font-medium text-warning">De validat</th><td className="px-4 py-3">Verifică referința și valorile, apoi confirmă sau corectează rândul.</td></tr>
                  <tr><th scope="row" className="px-4 py-3 font-medium text-success">Potrivire exactă</th><td className="px-4 py-3">Descrierile coincid și rândul nu cere confirmare manuală. Poți verifica și modifica prețurile dacă lucrarea o cere.</td></tr>
                  <tr><th scope="row" className="px-4 py-3 font-medium text-success">Validat</th><td className="px-4 py-3">Ai confirmat rândul manual. Poți corecta valorile cu creionul sau anula validarea cu săgeata de anulare.</td></tr>
                </tbody>
              </table>
            </div>
            <p><strong>Calitate: …/10</strong> arată cât de apropiate sunt descrierile. Un scor mare te ajută să te orientezi, dar verifică în continuare dacă materialul corespunde cerinței.</p>
            <Tip><p>Activează <strong>Nevalidate</strong> în bara de instrumente ca să lucrezi direct la rândurile care cer verificare. După confirmare, rândul dispare din această vedere. Dezactivează filtrul ca să vezi din nou toate materialele. Poți sorta lista apăsând antetele coloanelor; un al doilea click inversează ordinea.</p></Tip>
            <h3 className="text-lg font-semibold">Validarea mai multor materiale</h3>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Deschide <strong className="text-foreground">Validare multiplă</strong> și alege calitatea minimă, între 1 și 10.</li>
              <li>Apasă <strong className="text-foreground">Verifică eligibile</strong> pentru a vedea câte materiale pot fi confirmate.</li>
              <li>Apasă <strong className="text-foreground">Validează</strong>. Acțiunea include toate paginile foii selectate, nu doar rândurile vizibile. Dacă oferta nu are un selector de foi, se aplică listei ofertei.</li>
            </ol>
            <p className="text-sm text-muted-foreground">Materialele fără potrivire, cu erori, cantitate zero sau prețuri nevalide necesită verificare manuală. Dacă schimbi pragul ori oferta este modificată, verifică din nou numărul de materiale eligibile.</p>
            <p className="text-sm text-muted-foreground">Exemplu: în Excel ai „Cablu 3×2,5 mm²”, iar ochiul arată „Cablu 3×1,5 mm²”. Verifică prețul potrivit pentru secțiunea cerută și corectează valorile înainte de validare. Dacă apare „Nu a fost găsit în baza de date” sau „Eroare la căutare”, caută o referință în catalog și completează valorile necesare.</p>
            <p className="text-sm text-muted-foreground">Corectarea din ofertă modifică doar rândul acelei oferte. Catalogul se actualizează separat, prin Salvează în catalog sau prin editarea din pagina Materiale. Dacă descrierea sau unitatea din Excel este greșită, corectează fișierul original și pornește o ofertă nouă.</p>
          </Section>

          <Section id="preturi-export" title="4. Prețuri, monedă și export">
            <p>Coloanele <strong>Achiziție / UM</strong>, <strong>Vânzare / UM</strong> și <strong>Manoperă / UM</strong> conțin valori pentru o singură unitate de măsură. Totalul ofertei adună vânzarea și manopera pentru cantitățile din listă.</p>
            <div className="rounded-xl bg-secondary p-5">
              <p className="font-semibold">Total pe rând = cantitate × (preț vânzare + manoperă)</p>
              <p className="mt-2 text-sm text-muted-foreground">Exemplu: 10 bucăți × (125 € vânzare + 20 € manoperă) = 1.450 €. Prețul de achiziție este afișat separat și nu se adaugă încă o dată la acest total.</p>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Calculul implicit:</strong> când nu este configurat un multiplicator și vânzarea din catalog este 0, se folosește achiziție × 1,25. Un preț de vânzare existent în catalog se păstrează până îl modifici.</li>
              <li><strong className="text-foreground">Multiplicator configurat:</strong> prețul de vânzare devine achiziție × multiplicator. De exemplu, la 100 € achiziție și multiplicator 1,40 rezultă 140 € vânzare. Cantitatea și manopera nu se modifică.</li>
              <li><strong className="text-foreground">Schimbarea afișării:</strong> alege EUR sau RON în bara de instrumente. Verifică moneda scrisă lângă câmpurile de preț când faci corecturi. Multiplicatorul este același în ambele monede.</li>
              <li><strong className="text-foreground">Moneda Excelului exportat:</strong> urmează setarea de export a fiecărei foi, identificată din fișier sau corectată manual. Selectorul EUR / RON schimbă doar afișarea.</li>
            </ul>
            <h3 className="text-lg font-semibold">Un multiplicator pentru un singur material</h3>
            <p>Apasă creionul de pe rând și modifică <strong>Multiplicator preț vânzare</strong>. Prețul de vânzare se recalculează în panou. Multiplicatorul afișat reflectă raportul dintre vânzarea și achiziția curente când achiziția este mai mare decât zero. Când modifici achiziția, vânzarea se ajustează după acest raport. Poți introduce și direct un preț de vânzare. Apasă <strong>Salvează și validează</strong>; modificarea se aplică doar acelui material.</p>
            <h3 className="text-lg font-semibold">Un multiplicator pentru întreaga ofertă</h3>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Deschide <strong className="text-foreground">Prețuri</strong> din bara de instrumente.</li>
              <li>Introdu un multiplicator mai mare decât zero și apasă <strong className="text-foreground">Aplică tuturor materialelor</strong>.</li>
              <li>Verifică prețurile recalculate și totalul ofertei. Setarea se salvează doar pentru oferta curentă.</li>
            </ol>
            <p>Aplicarea include <strong>toate materialele din toate foile și paginile</strong>, chiar dacă filtrul Nevalidate este activ. Înlocuiește inclusiv prețurile și multiplicatorii modificați individual. Validările se păstrează, iar totalurile se actualizează direct, fără reanalizarea Excelului sau o nouă căutare în catalog. Poți modifica apoi separat multiplicatorul unui material.</p>
            <Tip><p>Dacă vrei un multiplicator general și câteva excepții, aplică întâi setarea pe ofertă, apoi editează materialele respective. O nouă aplicare pe întreaga ofertă înlocuiește excepțiile.</p></Tip>
            <p>În pagina <strong>Cursul BNR și prețurile metalelor</strong> poți verifica valorile și data actualizării. Butonul <strong>Actualizează</strong> cere date noi. Pentru conversia în RON și exportul în RON este necesar cursul EUR/RON.</p>
            <h3 className="text-lg font-semibold">Înainte să trimiți oferta</h3>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Verifică numărul de materiale și cantitățile față de lista originală, inclusiv rândurile de pe celelalte pagini ale tabelului.</li>
              <li>Verifică prețurile 0: pot fi intenționate, dar pot proveni și dintr-o căutare fără rezultat. Validarea confirmă valorile pe care le-ai acceptat.</li>
              <li>Verifică rândurile De validat și închide panoul de corectare. Dacă alegi să exporți cu materiale nevalidate, confirmă explicit în dialog.</li>
              <li>Apasă <strong className="text-foreground">Generează Excel</strong>, apoi <strong className="text-foreground">Descarcă</strong> din bara de instrumente. Fișierul păstrează documentul de intrare și adaugă coloanele de prețuri unitare și totalurile lor. Totalul vânzare + manoperă este afișat în aplicație.</li>
              <li>Deschide fișierul descărcat și verifică moneda, cantitățile și totalurile înainte de trimitere.</li>
            </ul>
            <Tip><p>Modificarea prețurilor, aplicarea unui multiplicator sau anularea unei validări retrag exportul curent. Generează și descarcă din nou Excelul pentru valorile actualizate; nu este necesară reluarea procesării ofertei. Fișierul descărcat anterior nu se actualizează singur.</p></Tip>
          </Section>

          <Section id="oferte" title="5. Reluarea unei oferte">
            <p>În <strong>Oferte</strong> găsești ofertele tale, cu numele fișierului, data creării, starea și numărul de materiale. Apasă pe numele fișierului sau pe butonul din coloana Acțiune pentru a continua lucrul ori pentru a descărca un Excel deja generat.</p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">De analizat / De extras materiale / De căutat prețuri:</strong> procesarea mai are etape de parcurs. Deschide oferta și apasă Reia procesarea.</li>
              <li><strong className="text-foreground">Validare necesară:</strong> mai sunt materiale care trebuie verificate.</li>
              <li><strong className="text-foreground">Gata de export:</strong> poți genera Excelul.</li>
              <li><strong className="text-foreground">Excel generat:</strong> fișierul completat este disponibil pentru descărcare.</li>
            </ul>
            <h3 className="text-lg font-semibold">Reluarea completă a procesării</h3>
            <p>Folosește <strong>Reia complet procesarea</strong> când vrei să refaci analiza, extragerea și căutarea prețurilor din același Excel. Într-o ofertă procesată, acțiunea este săgeata circulară din bara de instrumente. Deschide dialogul, citește ce va fi resetat și tastează exact <strong>REIA COMPLET OFERTA</strong>, apoi apasă <strong>Resetează și reia procesarea</strong>.</p>
            <p>Fișierul încărcat și foile selectate se păstrează. Structura identificată, materialele extrase, asocierile, prețurile editate, validările și exportul sunt resetate. Multiplicatorul general al ofertei se păstrează și se aplică noilor rezultate; excepțiile individuale se pierd.</p>
            <Tip><p>Pentru schimbarea multiplicatorului sau corectarea unui preț, folosește Prețuri ori creionul materialului. Reluarea completă șterge verificările anterioare și nu poate fi anulată.</p></Tip>
            <Tip><p>Dă listei de cantități un nume ușor de recunoscut înainte de încărcare, de exemplu „Client_Proiect_2026-10-13.xlsx”. Numele fișierului te ajută să găsești oferta în listă.</p></Tip>
            <p className="text-sm text-muted-foreground">Folosește coșul de gunoi doar când vrei să elimini oferta. Ștergerea cere confirmare și este permanentă.</p>
          </Section>

          <Section id="catalog" title="6. Căutarea în catalog">
            <p>În <a href="/catalog" className="underline underline-offset-2">Catalog</a> poți parcurge toate materialele în ordine alfabetică. Lista se încarcă pe măsură ce derulezi. Apasă pe antetul unei coloane pentru a sorta după descriere, prețul de achiziție, prețul de vânzare sau manoperă; un al doilea click inversează ordinea. Descrierile lungi pot fi deschise cu <strong>Extinde</strong>.</p>
            <p>Pagina <strong>Materiale</strong> te ajută să găsești repere de preț. Scrie o descriere în căutare, de exemplu „tub corugat 63” sau „cablu 3×2,5”. Rezultatele se actualizează pe măsură ce scrii.</p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Butonul cu text și lupă:</strong> caută după cuvintele din descriere. Este util când știi denumirea sau dimensiunea exactă.</li>
              <li><strong className="text-foreground">Butonul cu forma geometrică:</strong> caută materiale apropiate ca înțeles. Este util când aceeași piesă poate avea mai multe denumiri.</li>
              <li><strong className="text-foreground">Ambele activate:</strong> combină cele două căutări. Poți începe cu această opțiune.</li>
              <li><strong className="text-foreground">Alpha:</strong> când ambele căutări sunt active, o valoare mai mare pune mai mult accent pe asemănarea ca înțeles; una mai mică, pe cuvinte. După schimbarea opțiunilor, apasă lupa pentru a relansa căutarea.</li>
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <Control icon={Copy} title="Copiază un preț">Butonul de lângă prețul de achiziție sau manoperă copiază valoarea numerică. O poți lipi în Excel sau într-un câmp de preț.</Control>
              <Control icon={Pencil} title="Actualizează catalogul">Creionul deschide editarea descrierii și a prețurilor. Modificarea se salvează în catalog și va fi folosită la căutări și la ofertele procesate ulterior.</Control>
            </div>
            <h3 className="text-lg font-semibold">Salvarea dintr-o ofertă în catalog</h3>
            <p>După validarea unui material în ofertă, apasă pictograma <strong>Salvează în catalog</strong> de pe rând. Dialogul afișează prețurile unitare în EUR și două opțiuni:</p>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Actualizează prețurile materialului asociat:</strong> modifică achiziția, vânzarea și manopera în catalog, păstrând descrierea existentă.</li>
              <li><strong className="text-foreground">Adaugă un material nou:</strong> introdu descrierea și confirmă adăugarea. Materialul asociat anterior își păstrează prețurile.</li>
            </ul>
            <p className="text-sm text-muted-foreground">Salvarea este disponibilă doar pentru materiale validate, cu prețuri valide. Dacă referința existentă nu poate fi identificată în mod unic, asociază din nou materialul din catalog sau alege adăugarea unui material nou. Modificările se aplică la căutările viitoare; ofertele existente își păstrează prețurile.</p>
            <Tip><p>Dacă rezultatele sunt prea generale, adaugă diametrul, secțiunea sau tipul materialului. Dacă nu găsești nimic, încearcă o descriere mai scurtă sau o altă denumire, apoi verifică specificațiile în rezultate.</p></Tip>
            <p className="text-sm text-muted-foreground">Prețurile din catalog sunt în EUR. Ofertele deja procesate păstrează valorile lor; o schimbare în catalog nu le actualizează automat. Coșul de gunoi șterge permanent materialul după confirmare.</p>
          </Section>

          <Section id="materiale" title="7. Adăugarea și importul materialelor">
            <h3 className="text-lg font-semibold">Un singur material</h3>
            <p>Deschide <strong>Adaugă material</strong>, completează descrierea, prețul de achiziție, prețul de vânzare și manopera în EUR, apoi apasă <strong>Salvează material</strong>. Descrierea trebuie să aibă între 3 și 500 de caractere. Formularul manual acceptă prețuri întregi, pozitive sau 0. <strong>Resetează</strong> golește formularul.</p>
            <h3 className="text-lg font-semibold">Mai multe materiale dintr-un fișier</h3>
            <p>Apasă <strong>Importă CSV / XLSX</strong> și alege fișierul. Importul începe după selectare. Sunt acceptate fișiere de maximum <strong>10 MB</strong> și <strong>10.000 de rânduri</strong>; pentru XLSX se citește prima foaie.</p>
            <p>Pregătește coloanele în această ordine: <strong>descriere, pretAchizitie, pretVanzare, manopera</strong>. Poți lăsa două coloane goale la final, ca în exemplul de mai jos.</p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-secondary p-4 text-sm leading-7" aria-label="Exemplu de fișier CSV"><code>{'descriere,pretAchizitie,pretVanzare,manopera,,\n"Cablu 3x2,5 mm²","2.50","0","1.20",,\n"Tub corugat 63 mm","1.22","1.80","0.50",,'}</code></pre>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>În CSV, pune valorile între ghilimele și păstrează antetul pe prima linie. Salvează fișierul cu codificare UTF-8, pentru a păstra diacriticele.</li>
              <li>În XLSX, pune antetul în celule separate pe prima linie și fiecare material pe rândul lui. Nu este nevoie să adaugi ghilimele în celule.</li>
              <li>Importul acceptă prețuri zecimale. Prețurile goale sunt tratate ca 0, iar vânzarea 0 se calculează ca achiziție × 1,25.</li>
              <li>Dacă fișierul conține un rând invalid, corectează rândul indicat în mesaj și repetă importul. Validarea fișierului are loc înainte de salvare.</li>
              <li>Dacă mesajul spune că doar o parte a fost salvată, creează un fișier cu același antet și doar rândurile nesalvate. Reimportarea întregii liste poate crea duplicate.</li>
            </ul>
            <Tip><p>Importul din Adaugă material completează catalogul de prețuri. Pentru o ofertă cu cantități, încarcă lista în Generare AI.</p></Tip>
          </Section>

          <Section id="intrebari" title="8. Întrebări frecvente">
            <div className="divide-y divide-border rounded-xl border border-border px-5">
              {[
                ["De ce nu au fost identificate materiale?", "Structura identificată a Excelului poate fi greșită. În formularul de corectare manuală, verifică foaia, coloana cu descrierea materialelor și primul rând de date. Dacă ai selectat mai multe foi, mesajul indică foaia care trebuie corectată. Salvează structura pentru a relua procesarea."],
                ["Cum îmi schimb parola?", "Deschide meniul contului din header și apasă Schimbă parola. În dialog, introdu parola actuală, parola nouă de cel puțin 8 caractere și confirmarea ei, apoi apasă Schimbă parola. Rămâi conectat în sesiunea curentă; celelalte sesiuni ale contului sunt închise."],
                ["De ce nu pot apăsa Generează Excel?", "Închide panoul de corectare și așteaptă finalizarea operațiunilor în curs. Oferta trebuie să conțină materiale. Dacă afișarea este în RON și cursul lipsește, selectează EUR sau verifică pagina Cursul BNR și prețurile metalelor. Materialele nevalidate nu blochează butonul, dar exportul lor cere confirmare."],
                ["Am filtrul activ și tabelul este gol. S-au pierdut materialele?", "Dacă apare mesajul Nu mai există materiale de validat, ai terminat verificarea rândurilor care cereau confirmare. Dezactivează Nevalidate din bara de instrumente ca să vezi lista completă."],
                ["Cum anulez validarea unui material?", "Pe rândurile validate, săgeata Anulează validarea înlocuiește bifa. Apasă și confirmă în dialog. Materialul revine la verificare, prețurile se păstrează, iar exportul trebuie generat din nou."],
                ["Bifa este dezactivată. Ce fac?", "O potrivire exactă nu cere confirmare manuală. Pentru un rând De validat, verifică valorile cu creionul. Așteaptă terminarea operațiunilor în curs și închide panoul de corectare. Pe rândurile deja validate apare Anulează validarea în locul bifei."],
                ["Un material are prețul 0. Pot să îl confirm?", "Da, valorile 0 pot fi confirmate, dar verifică dacă sunt intenționate. Când nu s-a găsit o referință, valorile propuse pot fi toate 0. Cu un multiplicator configurat, vânzarea se calculează din achiziție și acel multiplicator; în lipsa lui, vânzarea 0 folosește regula achiziție × 1,25."],
                ["Trebuie să regenerez oferta după schimbarea multiplicatorului?", "Nu trebuie să reiei analiza sau căutarea prețurilor. Aplică multiplicatorul din Prețuri pentru toate materialele ori modifică-l cu creionul pentru un singur rând. Totalurile se actualizează direct. Dacă ai nevoie de un fișier cu noile valori, generează și descarcă din nou Excelul."],
                ["Multiplicatorul general păstrează excepțiile individuale?", "Aplică tuturor materialelor înlocuiește toate prețurile de vânzare și multiplicatorii individuali, în toate foile și paginile, inclusiv cu filtrul Nevalidate activ. Aplică întâi setarea generală, apoi introdu excepțiile cu creionul. Validările existente se păstrează."],
                ["Pot salva prețurile corectate în catalog?", "Da. Validează materialul și folosește Salvează în catalog de pe rând. Alege actualizarea prețurilor referinței asociate sau adăugarea unui material nou. Corectarea obișnuită din ofertă nu schimbă automat catalogul."],
                ["Pot continua mai târziu?", "Deschide oferta din Oferte. Validările și structura Excelului salvate rămân disponibile. Modificările încă nesalvate din panoul de corectare trebuie salvate înainte să pleci. Dacă procesarea s-a întrerupt, folosește Reia procesarea. Dacă trebuie să alegi alte coloane, deschide Corectează structura Excelului."],
                ["Am ales un Excel greșit. Cum îl schimb?", "Înainte de analiză, apasă Elimină și selectează fișierul corect. Dacă oferta a fost deja creată, începe o ofertă nouă cu Excelul corect."],
                ["Totalul apare ca o liniuță în RON. Ce înseamnă?", "Cursul EUR/RON se încarcă sau nu este disponibil. Selectează EUR în bara de instrumente pentru a vedea valorile în EUR. Verifică și actualizează cursul înainte de exportul unei oferte în RON."],
                ["Când folosesc Reia complet procesarea?", "Când vrei să refaci analiza și potrivirea din Excelul original, renunțând la rezultatele și corecturile existente. Dialogul cere textul REIA COMPLET OFERTA. Pentru schimbarea prețurilor sau multiplicatorului, folosește editarea și setările ofertei, care nu cer reluarea completă."],
                ["Am primit o eroare la importul catalogului. Reîncerc imediat?", "Dacă mesajul indică un rând invalid, corectează fișierul. Dacă indică salvare parțială sau o conexiune întreruptă, verifică întâi catalogul: unele materiale pot fi deja salvate. Reimportă doar materialele care lipsesc."],
              ].map(([question, answer]) => (
                <details key={question} className="group py-4"><summary className="cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-accent">{question}</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{answer}</p></details>
              ))}
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-secondary p-5"><Upload className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" /><p className="text-sm leading-relaxed"><strong>Ultima verificare:</strong> compară oferta descărcată cu lista de cantități, verifică materialele cu specificații apropiate, moneda și totalul final. Trimite versiunea generată după ultimele corecturi.</p></div>
          </Section>
        </article>
      </div>
      <ScrollToTop />
    </main>
  );
}
