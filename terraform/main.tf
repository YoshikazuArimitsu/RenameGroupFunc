variable "prefix" {
  default = "aritest"
}

variable "location" {
  default = "japaneast"
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}
data "azurerm_subscription" "current" {}
data "azuread_application_published_app_ids" "well_known" {}

# AzureAD Application
resource "azuread_service_principal" "msgraph" {
  application_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph
  use_existing   = true
}

resource "azuread_application" "app" {
  display_name     = "${var.prefix}-funcapp"
  sign_in_audience = "AzureADMyOrg"
  owners           = [data.azurerm_client_config.current.object_id]

  required_resource_access {
    # Microsoft Graph
    resource_app_id = data.azuread_application_published_app_ids.well_known.result.MicrosoftGraph

    resource_access {
      id   = azuread_service_principal.msgraph.app_role_ids["Group.ReadWrite.All"]
      type = "Scope"
    }
  }
}

resource "azuread_application_password" "app" {
  display_name          = "${var.prefix}-funcapp-secret"
  application_object_id = azuread_application.app.id
}

# ResourceGroup
resource "azurerm_resource_group" "rg" {
  location = var.location
  name     = "${var.prefix}-rg"
}

# Storage
resource "azurerm_storage_account" "storage" {
  name                     = "${var.prefix}storageaccount"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
}

resource "azurerm_storage_container" "container" {
  name                  = "container"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

# Function App
resource "azurerm_service_plan" "appplan" {
  name                = "${var.prefix}renamefuncappplan"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name

  os_type  = "Linux"
  sku_name = "B1"
}

resource "azurerm_linux_function_app" "renamefunc" {
  name                = "${var.prefix}renamefunc"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = azurerm_service_plan.appplan.id
  https_only          = false

  storage_account_name       = azurerm_storage_account.storage.name
  storage_account_access_key = azurerm_storage_account.storage.primary_access_key

  app_settings = {
    "AZURE_CLIENT_ID"     = azuread_application.app.client_id
    "AZURE_CLIENT_SECRET" = azuread_application_password.app.value
    "AZURE_TENANT_ID"     = data.azurerm_client_config.current.tenant_id
  }

  site_config {
    always_on  = true
    ftps_state = "FtpsOnly"

    application_stack {
      node_version = "18"
    }

    cors {
      allowed_origins = ["https://portal.azure.com"]
    }
  }
}

data "azurerm_function_app_host_keys" "hostkey" {
  name                = azurerm_linux_function_app.renamefunc.name
  resource_group_name = azurerm_resource_group.rg.name
  depends_on = [
    azurerm_linux_function_app.renamefunc
  ]
}

# output "function_key" {
#   value = data.azurerm_function_app_host_keys.hostkey.default_function_key
# }

output "function_host" {
  value = azurerm_linux_function_app.renamefunc.default_hostname
}
