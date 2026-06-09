CREATE TABLE "menu_role_access" (
	"role" text NOT NULL,
	"menu_key" text NOT NULL,
	"visible" boolean NOT NULL,
	CONSTRAINT "menu_role_access_role_menu_key_pk" PRIMARY KEY("role","menu_key")
);
