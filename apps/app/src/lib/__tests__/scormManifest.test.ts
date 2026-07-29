import { describe, expect, it } from 'vitest';
import { parseScormManifest, ScormManifestError } from '../scormManifest';

const SCORM_12_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Sample Course</title>
      <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index_lms.html">
      <file href="index_lms.html"/>
    </resource>
  </resources>
</manifest>`;

const SCORM_2004_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course2004" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Sample 2004 Course</title>
      <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormType="sco" href="story.html">
      <file href="story.html"/>
    </resource>
  </resources>
</manifest>`;

// Elements prefixed with a namespace (e.g. authoring tools that emit
// `<cp:organizations>`, `<cp:item>` etc. instead of unprefixed elements).
// A structurally valid manifest that merely prefixes its elements must
// still parse correctly.
const SCORM_NAMESPACED_PREFIX_MANIFEST = `<?xml version="1.0"?>
<cp:manifest identifier="com.example.course.ns" version="1"
  xmlns:cp="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <cp:metadata><cp:schema>ADL SCORM</cp:schema><cp:schemaversion>1.2</cp:schemaversion></cp:metadata>
  <cp:organizations default="ORG1">
    <cp:organization identifier="ORG1">
      <cp:title>Namespaced Course</cp:title>
      <cp:item identifier="ITEM1" identifierref="RES1"><cp:title>Lesson 1</cp:title></cp:item>
    </cp:organization>
  </cp:organizations>
  <cp:resources>
    <cp:resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index_lms.html">
      <cp:file href="index_lms.html"/>
    </cp:resource>
  </cp:resources>
</cp:manifest>`;

// Some authoring tools wrap the real launchable item in a title-only menu
// item even for single-SCO courses. The first <item> in document order has
// no identifierref; the actual SCO is nested one level down.
const SCORM_WRAPPER_ITEM_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course.wrapper" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Wrapped Course</title>
      <item identifier="wrapper"><title>Module 1</title>
        <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index_lms.html">
      <file href="index_lms.html"/>
    </resource>
  </resources>
</manifest>`;

// No <schemaversion> element at all — version must be inferred from the
// adlcp_rootv1p2 namespace attribute on the root <manifest> element.
const SCORM_NO_SCHEMAVERSION_MANIFEST = `<?xml version="1.0"?>
<manifest identifier="com.example.course.noversion" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>No Schemaversion Course</title>
      <item identifier="ITEM1" identifierref="RES1"><title>Lesson 1</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index_lms.html">
      <file href="index_lms.html"/>
    </resource>
  </resources>
</manifest>`;

describe('parseScormManifest', () => {
  it('detects SCORM 1.2 and resolves the launch file', () => {
    const result = parseScormManifest(SCORM_12_MANIFEST);
    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index_lms.html');
    expect(result.title).toBe('Sample Course');
  });

  it('detects SCORM 2004 and resolves the launch file', () => {
    const result = parseScormManifest(SCORM_2004_MANIFEST);
    expect(result.version).toBe('2004');
    expect(result.launchPath).toBe('story.html');
    expect(result.title).toBe('Sample 2004 Course');
  });

  it('throws ScormManifestError when there is no default organization', () => {
    const bad = SCORM_12_MANIFEST.replace('default="ORG1"', 'default="MISSING"');
    expect(() => parseScormManifest(bad)).toThrow(ScormManifestError);
  });

  it('throws ScormManifestError when the referenced resource is missing', () => {
    const bad = SCORM_12_MANIFEST.replace('identifier="RES1" type="webcontent"', 'identifier="OTHER" type="webcontent"');
    expect(() => parseScormManifest(bad)).toThrow(ScormManifestError);
  });

  it('throws ScormManifestError on malformed XML', () => {
    expect(() => parseScormManifest('<manifest><organizations>')).toThrow(ScormManifestError);
  });

  it('parses a manifest whose elements use a namespace prefix (e.g. cp:organizations)', () => {
    const result = parseScormManifest(SCORM_NAMESPACED_PREFIX_MANIFEST);
    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index_lms.html');
    expect(result.title).toBe('Namespaced Course');
  });

  it('resolves the real launchable item nested inside a title-only wrapper item', () => {
    const result = parseScormManifest(SCORM_WRAPPER_ITEM_MANIFEST);
    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index_lms.html');
    expect(result.title).toBe('Wrapped Course');
  });

  it('falls back to the adlcp namespace attribute to detect the version when <schemaversion> is absent', () => {
    const result = parseScormManifest(SCORM_NO_SCHEMAVERSION_MANIFEST);
    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index_lms.html');
    expect(result.title).toBe('No Schemaversion Course');
  });
});
