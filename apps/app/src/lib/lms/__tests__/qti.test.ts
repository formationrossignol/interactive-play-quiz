import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildAssessmentItemXml, parseQtiPackage } from '../qti';

function manifest(resources: { href: string }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="M1">
  <metadata><title>Test QTI Package</title></metadata>
  <resources>
    ${resources.map((r) => `<resource identifier="${r.href}" type="imsqti_item_xmlv3p0" href="${r.href}"><file href="${r.href}"/></resource>`).join('\n')}
  </resources>
</manifest>`;
}

function choiceItemXml(identifier: string, multiple = false): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="${multiple ? 'multiple' : 'single'}" baseType="identifier">
    <correctResponse><value>choiceA</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>What is 2+2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="${multiple ? 0 : 1}">
      <simpleChoice identifier="choiceA">4</simpleChoice>
      <simpleChoice identifier="choiceB">5</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
}

function unsupportedInteractionXml(identifier: string): string {
  // qti-drawing / graphicOrderInteraction have no real correspondence in
  // this app's item bank (see qti.ts's classifyInteraction default branch).
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="Weird" adaptive="false" timeDependent="false">
  <itemBody>
    <p>Draw the shape.</p>
    <drawingInteraction responseIdentifier="RESPONSE" />
  </itemBody>
</assessmentItem>`;
}

async function toFile(zip: JSZip, name: string): Promise<File> {
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/zip' });
}

describe('parseQtiPackage', () => {
  it('imports a single-choice item with its correct response', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest([{ href: 'item1.xml' }]));
    zip.file('item1.xml', choiceItemXml('external-item-1'));
    const file = await toFile(zip, 'pkg.zip');

    const result = await parseQtiPackage(file);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.outcome).toBe('imported');
    expect(item.item_type).toBe('single_choice');
    expect(item.external_id).toBe('external-item-1');
    expect(item.correct_answer).toEqual({ optionId: 'choiceA' });
  });

  it('maps a multiple-cardinality choice interaction to mcq, not single_choice', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest([{ href: 'item1.xml' }]));
    zip.file('item1.xml', choiceItemXml('external-item-2', true));
    const file = await toFile(zip, 'pkg.zip');

    const result = await parseQtiPackage(file);
    expect(result.items[0].item_type).toBe('mcq');
  });

  // QTI-003: "aucun type inconnu n'est silencieusement converti en QCM" —
  // an interaction with no genuine mapping must be rejected with a reason,
  // never coerced into mcq/single_choice/anything else as a fallback.
  it('rejects an unsupported interaction type instead of silently downgrading it to a known type', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest([{ href: 'item1.xml' }]));
    zip.file('item1.xml', unsupportedInteractionXml('external-item-3'));
    const file = await toFile(zip, 'pkg.zip');

    const result = await parseQtiPackage(file);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.outcome).toBe('rejected');
    expect(item.item_type).toBeNull();
    expect(item.reason).toMatch(/drawingInteraction/);
    // Never any of the 20 real item_type values as a fallback:
    expect(item.item_type).not.toBe('mcq');
    expect(item.item_type).not.toBe('single_choice');
  });

  it('rejects an item with multiple interactions rather than guessing which one matters', async () => {
    const multi = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="ext-4" title="Multi" adaptive="false" timeDependent="false">
  <itemBody>
    <p>Two interactions</p>
    <choiceInteraction responseIdentifier="R1" />
    <orderInteraction responseIdentifier="R2" />
  </itemBody>
</assessmentItem>`;
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest([{ href: 'item1.xml' }]));
    zip.file('item1.xml', multi);
    const file = await toFile(zip, 'pkg.zip');

    const result = await parseQtiPackage(file);
    expect(result.items[0].outcome).toBe('rejected');
    expect(result.items[0].item_type).toBeNull();
  });

  it('throws a clear error when imsmanifest.xml is missing', async () => {
    const zip = new JSZip();
    zip.file('item1.xml', choiceItemXml('ext-5'));
    const file = await toFile(zip, 'pkg.zip');
    await expect(parseQtiPackage(file)).rejects.toThrow(/imsmanifest/);
  });
});

// QTI-004: "les identifiants externes ... sont conservés" — an item
// re-exported after a QTI import must carry the SAME qti identifier it was
// imported with, not a freshly generated one.
describe('buildAssessmentItemXml (export) — external_id round-trip', () => {
  it('re-embeds the exact external_id an item was imported with, not a new identifier', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest([{ href: 'item1.xml' }]));
    zip.file('item1.xml', choiceItemXml('original-external-id-42'));
    const file = await toFile(zip, 'pkg.zip');

    const imported = (await parseQtiPackage(file)).items[0];
    expect(imported.external_id).toBe('original-external-id-42');

    const xml = buildAssessmentItemXml({
      external_id: imported.external_id,
      item_type: imported.item_type!,
      prompt: imported.prompt!,
      correct_answer: imported.correct_answer,
    });

    expect(xml).not.toBeNull();
    expect(xml).toContain('identifier="original-external-id-42"');
    // Never silently regenerate a fresh identifier when one was preserved:
    expect(xml).not.toMatch(/identifier="item-0\./);
  });

  it('generates a fallback identifier only when no external_id exists (never for a re-exported imported item)', () => {
    const xml = buildAssessmentItemXml({
      external_id: null,
      item_type: 'single_choice',
      prompt: { text: 'Q', options: [{ id: 'a', label: 'A' }] },
      correct_answer: { optionId: 'a' },
    });
    expect(xml).toMatch(/identifier="item-/);
  });

  it('returns null (excluded, not faked) for an item_type with no real QTI correspondence', () => {
    const xml = buildAssessmentItemXml({
      external_id: 'ext-1',
      item_type: 'drag_drop',
      prompt: { text: 'Q' },
      correct_answer: {},
    });
    expect(xml).toBeNull();
  });
});
