NAME_FORM_ID = "formId_";

function elemNameForItem(item)
{
   var itemID = item.getId();
   var elemName = "elem-" + itemID;
   return elemName;
}

function myClickHandler(eventInfo)
{
   var parameter = eventInfo.parameter;
   Logger.log(JSON.stringify(parameter, null, 2));
   var formId = parameter[NAME_FORM_ID];
   var form = FormApp.openById(formId);

   var response = form.createResponse(); 
   var formItems = form.getItems();
   for (var i in formItems)
   {
      var item = formItems[i];
      var elemName = elemNameForItem(item);
      if (item.getType() == FormApp.ItemType.TEXT)
      {
         var textItem = item.asTextItem();
         var itemResponse = textItem.createResponse(parameter[elemName]);
         Logger.log("Adding response " + itemResponse.getResponse());
         response.withItemResponse(itemResponse);
      }
      else if (item.getType() == FormApp.ItemType.MULTIPLE_CHOICE)
      {
         var mcItem = item.asMultipleChoiceItem();
         var itemResponse = mcItem.createResponse(parameter[elemName]);
         Logger.log("Adding response " + itemResponse.getResponse());
         response.withItemResponse(itemResponse);
      }
      else if (item.getType() == FormApp.ItemType.PAGE_BREAK)
      {
         var pbItem = item.asPageBreakItem();
      }
      else
      {
         Logger.log("Unrecognized item type " + item.getType());
      }
   }

   Logger.log("edit URL: " + response.getEditResponseUrl());
   response.submit(); // This currently crashes
   Logger.log("edit URL: " + response.getEditResponseUrl());

   var app = UiApp.getActiveApplication();
   app.close();
   return app;
}

function makeLabelForItem(app, item)
{
   var title = item.getTitle();
   required = false;
   if (item.getType() == FormApp.ItemType.TEXT)
   {
      required = item.asTextItem().isRequired();
   }
   else if (item.getType() == FormApp.ItemType.MULTIPLE_CHOICE)
   {
      required = item.asMultipleChoiceItem().isRequired();
   }
   else
   {
      Logger.log("Unknown item type " + item.getType());
   }

   if (required)
   {
      title = title + "*";
   }

   return app.createLabel(title);
}

function makeAppForForm(form)
{
   var app = UiApp.createApplication();
   var vPanel = app.createVerticalPanel();

   var hidden = app.createHidden(NAME_FORM_ID, form.getId()).
      setID(NAME_FORM_ID);

   var handler = app.createServerHandler('myClickHandler');

   var formItems = form.getItems();
   for (var i in formItems)
   {
      var item = formItems[i];
      var elemName = elemNameForItem(item);
      // Cast the generic item to the text-item class.
      if (item.getType() == FormApp.ItemType.PAGE_BREAK)
      {
         var html = app.createHTML("<hr>");
         html.setId(elemName);
         vPanel.add(html);
      }
      else
      {
         vPanel.add(makeLabelForItem(app, item));
         if (item.getType() == FormApp.ItemType.TEXT)
         {
            var textItem = item.asTextItem();
            var textBox = app.createTextBox().
               setName(elemName).
               setId(elemName);
            handler.addCallbackElement(textBox);
            vPanel.add(textBox);
         }
         else if (item.getType() == FormApp.ItemType.MULTIPLE_CHOICE)
         {
            var mcItem = item.asMultipleChoiceItem();     
            var choices = mcItem.getChoices();
            var radioElemName = elemName + "-radio";

            // code.google.com/p/google-apps-script-issues/issues/detail?id=506
            // stackoverflow.com/questions/17217839
            var hiddenText = app.createTextBox().
               setName(elemName);

            for (choiceIdx in choices)
            {
               var choice = choices[choiceIdx];
               var mcBox = app.createRadioButton(
                     radioElemName, choice.getValue()).
                  setId(radioElemName);
               var radioHandler = app.createClientHandler().
                  forTargets(hiddenText).setText(choice.getValue());
               mcBox.addClickHandler(radioHandler);
               vPanel.add(mcBox);
            }

            if (mcItem.hasOtherOption())
            {
               var otherRadio = app.createRadioButton(radioElemName,
                     "Other: ");
               vPanel.add(otherRadio);
               hiddenText.addClickHandler(
                     app.createClientHandler().forTargets(otherRadio).
                     setValue(true));
               otherRadio.addClickHandler(
                     app.createClientHandler().forTargets(hiddenText).
                     setText(""));
            }

            if (!mcItem.hasOtherOption())
            {
               hiddenText.setVisible(false);
            }
            handler.addCallbackElement(hiddenText);
            vPanel.add(hiddenText);
         }
         else
         {
            Logger.log("Unrecognized type " + item.getType());
         }
      }
   }

   var button = app.createButton('Submit');
   vPanel.add(button);

   app.add(vPanel);

   handler.addCallbackElement(hidden);
   button.addClickHandler(handler);

   return app;
}

function doGet()
{
   var form = FormApp.openById('1v8ws09PQQyCMqOl3LT27XuyHnx2iljqUVIyHitsI33M');
   return makeAppForForm(form);
}
