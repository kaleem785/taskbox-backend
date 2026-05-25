-- Drop Tab.color / Tab.icon: tabs render as plain text labels with a fixed brand
-- color on the customer screen; neither field was rendered. (Badge keeps its own.)
ALTER TABLE "tabs" DROP COLUMN "color";
ALTER TABLE "tabs" DROP COLUMN "icon";
