/** Tool registry. */
import { t } from '../i18n.ts';
import type { GroupId, ToolDef } from '../tool-types.ts';
import { converterTools } from './converters.ts';
import { jsonCodegenTool, xmlCodegenTool } from './codegen.ts';
import { textTools } from './text.ts';
import { encoderTools } from './encoders.ts';
import { formatterTools } from './formatters.ts';
import { generatorTools } from './generators.ts';
import { graphicTools } from './graphic.ts';
import { testerTools } from './testers.ts';
import { iconTools } from './icons.ts';
import { thirdPartyTools } from './thirdparty.ts';

export const groupOrder: Array<{ id: GroupId; label: () => string }> = [
  { id: 'converters', label: () => t('group.converters') },
  { id: 'text', label: () => t('group.text') },
  { id: 'encoders', label: () => t('group.encoders') },
  { id: 'formatters', label: () => t('group.formatters') },
  { id: 'generators', label: () => t('group.generators') },
  { id: 'graphic', label: () => t('group.graphic') },
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
  ...formatterTools,
  ...generatorTools,
  ...graphicTools,
  ...testerTools,
  ...iconTools,
  ...thirdPartyTools,
];
