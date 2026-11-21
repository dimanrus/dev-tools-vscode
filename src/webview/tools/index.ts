/** Tool registry. */
import { t } from '../i18n.ts';
import type { GroupId, ToolDef } from '../tool-types.ts';
import { converterTools } from './converters.ts';
import { jsonCodegenTool, xmlCodegenTool } from './codegen.ts';
import { textTools } from './text.ts';
import { encoderTools } from './encoders.ts';
import { symmetricTools } from './crypto-symmetric.ts';
import { gostTools } from './crypto-gost.ts';
import { asymmetricTools } from './crypto-asymmetric.ts';
import { signatureTools } from './crypto-signatures.ts';
import { kdfTools } from './crypto-kdf.ts';
import { classicTools } from './crypto-classic.ts';
import { formatterTools } from './formatters.ts';
import { generatorTools } from './generators.ts';
import { fakeDataTools } from './fake-data.ts';
import { pdfTools } from './pdf-toolkit.ts';
import { graphicTools } from './graphic.ts';
import { imageAdjustTools } from './image-adjust.ts';
import { imageEditorTools } from './image-editor.ts';
import { vectorEditorTools } from './vector-editor.ts';
import { audioEditorTools } from './audio-editor.ts';
import { videoEditorTools } from './video-editor.ts';
import { sceneEditorTools } from './scene-editor.ts';
import { cadEditorTools } from './cad-editor.ts';
import { animationTools } from './animation.ts';
import { shaderTools } from './shader.ts';
import { mediaMetadataTools } from './media-metadata.ts';
import { testerTools } from './testers.ts';
import { iconTools } from './icons.ts';
import { thirdPartyTools } from './thirdparty.ts';

export const groupOrder: Array<{ id: GroupId; label: () => string }> = [
  { id: 'converters', label: () => t('group.converters') },
  { id: 'text', label: () => t('group.text') },
  { id: 'encoders', label: () => t('group.encoders') },
  { id: 'crypto', label: () => t('group.crypto') },
  { id: 'formatters', label: () => t('group.formatters') },
  { id: 'generators', label: () => t('group.generators') },
  { id: 'graphic', label: () => t('group.graphic') },
  { id: 'media', label: () => t('group.media') },
  { id: 'testers', label: () => t('group.testers') },
  { id: 'icons', label: () => t('group.icons') },
  { id: 'thirdparty', label: () => t('group.thirdparty') },
];

export const tools: ToolDef[] = [
  ...converterTools,
  jsonCodegenTool,
  xmlCodegenTool,
  ...textTools,
  ...encoderTools,
  ...symmetricTools,
  ...gostTools,
  ...asymmetricTools,
  ...signatureTools,
  ...kdfTools,
  ...classicTools,
  ...formatterTools,
  ...generatorTools,
  ...fakeDataTools,
  ...pdfTools,
  ...graphicTools,
  ...imageAdjustTools,
  ...imageEditorTools,
  ...vectorEditorTools,
  ...audioEditorTools,
  ...videoEditorTools,
  ...sceneEditorTools,
  ...cadEditorTools,
  ...animationTools,
  ...shaderTools,
  ...mediaMetadataTools,
  ...testerTools,
  ...iconTools,
  ...thirdPartyTools,
];
