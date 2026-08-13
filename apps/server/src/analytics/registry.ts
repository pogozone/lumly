import type { AnalyticsModule } from "./types.js";
import { overviewModule } from "./modules/overview.js";
import { trafficModule } from "./modules/traffic.js";
import { contentModule } from "./modules/content.js";
import { acquisitionModule } from "./modules/acquisition.js";
import { eventsModule } from "./modules/events.js";
import { engagementModule } from "./modules/engagement.js";
import { devicesModule } from "./modules/devices.js";
import { geographyModule } from "./modules/geography.js";
import { performanceModule } from "./modules/performance.js";
import { funnelsModule } from "./modules/funnels.js";
import { retentionModule } from "./modules/retention.js";
import { privacyModule } from "./modules/privacy.js";

export const analyticsModules: AnalyticsModule[] = [
  overviewModule,
  trafficModule,
  contentModule,
  acquisitionModule,
  eventsModule,
  engagementModule,
  devicesModule,
  geographyModule,
  performanceModule,
  funnelsModule,
  retentionModule,
  privacyModule
];

export function getModule(id: string): AnalyticsModule | undefined {
  return analyticsModules.find((m) => m.id === id);
}
