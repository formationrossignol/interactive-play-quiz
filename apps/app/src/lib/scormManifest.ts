export class ScormManifestError extends Error {}

export interface ScormManifestInfo {
  version: '1.2' | '2004';
  launchPath: string;
  title: string;
}

function detectVersion(doc: Document): '1.2' | '2004' {
  const schemaVersionEl = doc.getElementsByTagName('schemaversion')[0];
  const schemaVersion = schemaVersionEl?.textContent ?? '';
  if (/2004/.test(schemaVersion)) return '2004';
  if (/1\.2/.test(schemaVersion)) return '1.2';

  const manifestEl = doc.documentElement;
  const attrs = Array.from(manifestEl.attributes).map((a) => a.value).join(' ');
  if (/adlcp_v1p3|adlcp_v1p4/.test(attrs)) return '2004';
  if (/adlcp_rootv1p2/.test(attrs)) return '1.2';

  throw new ScormManifestError("Impossible de déterminer la version SCORM (schemaversion introuvable dans imsmanifest.xml).");
}

export function parseScormManifest(xml: string): ScormManifestInfo {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ScormManifestError("imsmanifest.xml invalide (XML mal formé).");
  }

  const version = detectVersion(doc);

  const organizationsEl = doc.getElementsByTagName('organizations')[0];
  if (!organizationsEl) throw new ScormManifestError("Aucun élément <organizations> dans imsmanifest.xml.");

  const defaultId = organizationsEl.getAttribute('default');
  const organizations = Array.from(doc.getElementsByTagName('organization'));

  let organization: Element | undefined;
  if (defaultId) {
    // A default id was declared: it must resolve to a real <organization>.
    // Silently falling back to the first organization here would mask a
    // broken/mismatched manifest instead of surfacing it.
    organization = organizations.find((o) => o.getAttribute('identifier') === defaultId);
    if (!organization) {
      throw new ScormManifestError(`Organisation par défaut "${defaultId}" introuvable dans imsmanifest.xml.`);
    }
  } else {
    organization = organizations[0];
  }
  if (!organization) throw new ScormManifestError("Aucune organisation trouvée dans imsmanifest.xml.");

  const titleEl = organization.getElementsByTagName('title')[0];
  const title = titleEl?.textContent?.trim() || 'Package SCORM importé';

  const firstItem = Array.from(organization.getElementsByTagName('item'))[0];
  if (!firstItem) throw new ScormManifestError("Aucun <item> lançable dans l'organisation par défaut.");

  const resourceRef = firstItem.getAttribute('identifierref');
  if (!resourceRef) throw new ScormManifestError("<item> sans identifierref.");

  const resource = Array.from(doc.getElementsByTagName('resource'))
    .find((r) => r.getAttribute('identifier') === resourceRef);
  if (!resource) throw new ScormManifestError(`Ressource "${resourceRef}" introuvable dans <resources>.`);

  const launchPath = resource.getAttribute('href');
  if (!launchPath) throw new ScormManifestError("La ressource lançable n'a pas d'attribut href.");

  return { version, launchPath, title };
}
