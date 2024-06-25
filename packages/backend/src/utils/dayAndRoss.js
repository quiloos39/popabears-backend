import axios from "axios";
import xml2js from "xml2js";

class Freightcom {
  constructor() {
    this.getRate2 = (deliveryType, cart) => this.getRate2_(deliveryType, cart);
  }

  getRate2_ = async (deliveryType, cart) => {
    const canadaProvinces = {
      Alberta: "AB",
      "British Columbia": "BC",
      Manitoba: "MB",
      "New Brunswick": "NB",
      "Newfoundland and Labrador": "NL",
      "Nova Scotia": "NS",
      Ontario: "ON",
      "Prince Edward Island": "PE",
      Québec: "QC",
      Quebec: "QC",
      Saskatchewan: "SK",
      "Northwest Territories": "NT",
      Nunavut: "NU",
      Yukon: "YT",
    };

    var requestLocationInfoFromKey = (locationKey) => {
      switch (locationKey) {
        case "sc_01H54KV0V84HGG6PZD06T3J8C4":
          return {
            key_for_slug: "value_barrie",
            key: "sc_01H54KV0V84HGG6PZD06T3J8C4",
            name: "Value Barrie",
            city: "BARRIE", // DAY AND ROSS IS HSIT
            countryCODE: "CA",
            ZIP: "L0L1P0",
            address: "2090 flos road east elmvale",
            province: "Ontario",
            opening_hours: { open: 9, close: 6 },
            days: "monday trough saturday",
            phone_number: "(705) 995-4833",
          };
        case "sc_01H54KTSHXG7TYSRN9XND4HHQB":
          return {
            key_for_slug: "value_sainte_julie",
            key: "sc_01H54KTSHXG7TYSRN9XND4HHQB",
            name: "Value Sainte Julie",
            address: "1341 rue principale Sainte Julie Quebec",
            countryCODE: "CA",
            ZIP: "J3E0C4",
            opening_hours: { open: 9, close: 6 },
            days: "monday to friday",
            province: "Quebec",
            city: "MONTREAL",
            phone_number: "(705) 995-4833",
          };
      }
    };

    var myHeaders = new Headers();

    myHeaders.append("Content-Type", "text/xml; charset=utf-8");

    const locationInfo = requestLocationInfoFromKey(cart.sales_channel_id);
    console.log("location infoo", locationInfo);

    const shipperCity = locationInfo.city;
    const shipperZIP = locationInfo.ZIP;
    const shipperCountry = locationInfo.countryCODE;
    const shipperProvince = locationInfo.province;

    const { shipping_address } = cart;
    const { postal_code, city, country_code, province } = shipping_address;
    const items = cart.items;

    let generateXMLString = async () => {
      try {
        const promises = items.map(async (item) => {
          const quantity = item.quantity
          const response = await fetch(
            `http://localhost:9000/store/products/${item.variant.product_id}`
          );
          const product = await response.json();
          const productInfo = product.product;
          const { weight, length, width, height } = productInfo;

          return `
           <ShipmentItem>\n
              <Description>desc</Description>\n
              <Length>${length}</Length>\n
              <Width>${width}</Width>\n
              <Height>${height}</Height>\n
              <LengthUnit>Inches</LengthUnit>\n
              <Pieces>${quantity}</Pieces>\n
              <Weight>${weight}</Weight>\n
              <WeightUnit>Pounds</WeightUnit>\n
            </ShipmentItem>\n
          `;
        });

        const results = await Promise.all(promises);
        const XMLstring = results.join("");

        return XMLstring;
      } catch (error) {
        // Handle any errors that might occur during the fetching process
        console.error("Error fetching data:", error);
      }
    };
    const lineItems = await generateXMLString();
    console.log('what is the lin items', lineItems)

    // get cart info
    // map through fetch with js
    //get baseinfo from json

    const LTLSLUG =
      deliveryType === "day-and-ross-tailgate"
        ? (() => {
            return `<SpecialServices>\n
        <ShipmentSpecialService>\n
        <Code>TLGPU</Code>\n
        </ShipmentSpecialService>\n
        </SpecialServices>\n`;
          })()
        : (() => {
            return ``;
          })();

    console.log(
      "what is thiiii",
      shipperCity,
      canadaProvinces[shipperProvince],
      shipperZIP.toUpperCase(),
      shipperCountry.toUpperCase(),
      city.toUpperCase(),
      canadaProvinces[province],
      postal_code.toUpperCase(),
      country_code.toUpperCase(),
      lineItems,
      LTLSLUG
    );

    var raw = `<?xml version="1.0" encoding="UTF-8"?>\n
      <S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">\n
          <SOAP-ENV:Header/>\n
          <S:Body>\n
              <GetRate2 xmlns="http://dayrossgroup.com/web/public/webservices/shipmentServices" xmlns:ns2="http://www.dayrossgroup.com/web/common/webServices/OnlineShipping">\n
                  <division>GeneralFreight</division>\n
                  <emailAddress>info@cbico.ca</emailAddress>\n
                  <password>PWD163447</password>\n
                  <shipment>\n
                      <ShipperAddress>\n
                          <City>${shipperCity.toUpperCase()}</City>\n
                          <Province>${
                            canadaProvinces[shipperProvince]
                          }</Province>\n
                          <PostalCode>${shipperZIP.toUpperCase()}</PostalCode>\n
                          <Country>${shipperCountry.toUpperCase()}</Country>\n
                      </ShipperAddress>\n
                      <ConsigneeAddress>\n
                          <City>${city.toUpperCase()}</City>\n
                          <Province>${canadaProvinces[province]}</Province>\n
                          <PostalCode>${postal_code.toUpperCase()}</PostalCode>\n
                          <Country>${country_code.toUpperCase()}</Country>\n
                      </ConsigneeAddress>\n
                      <BillToAccount>163447</BillToAccount>\n
                      <Items>\n
                        ${lineItems}
                      </Items>\n
                      ${LTLSLUG}
                  </shipment>\n
              </GetRate2>\n
          </S:Body>\n
      </S:Envelope>`;

    var requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    // fetch(
    //   "https://dayross.dayrossgroup.com/public/ShipmentServices.asmx",
    //   requestOptions
    // )
    //   .then((response) => response.text())
    //   .then((resultXML) => {
    //     xml2js.parseString(resultXML, (err, result) => {
    //       if (err) {
    //         console.error("Error parsing XML:", err);
    //       } else {
    //         const jsonData = result;
    //         console.log('what the fuck is this json',jsonData['soap:Envelope']['soap:Body'][0].GetRate2Response[0].GetRate2Result[0].ServiceLevels[0]);
    //         console.log('what the fuck is this json',jsonData['soap:Envelope']['soap:Body'][0].GetRate2Response[0].GetRate2Result[0].ServiceLevels[0].TotalAmount[0]);
    //         console.log('what the fuck is this json',jsonData['soap:Envelope']['soap:Body'][0].GetRate2Response[0].GetRate2Result[0].ServiceLevels[0].ShipmentCharges[0].ShipmentCharge[0].Amount[0]);

    //         return jsonData['soap:Envelope']['soap:Body'][0].GetRate2Response[0].GetRate2Result[0].ServiceLevels[0].TotalAmount[0];
    //       }
    //     });
    //   })
    //   .catch((error) => console.log("error parsing XML", error));

    const fetchDataAndParseXML = async () => {
      try {
        const response = await fetch(
          "https://dayross.dayrossgroup.com/public/ShipmentServices.asmx",
          requestOptions
        );
        const resultXML = await response.text();
        const jsonData = await xml2js.parseStringPromise(resultXML);

        console.log(
          "ServiceLevels:",
          jsonData["soap:Envelope"]["soap:Body"][0].GetRate2Response[0]
            .GetRate2Result[0].ServiceLevels[0]
        );
        console.log(
          "TotalAmount:",
          jsonData["soap:Envelope"]["soap:Body"][0].GetRate2Response[0]
            .GetRate2Result[0].ServiceLevels[0].TotalAmount[0]
        );
        console.log(
          "ShipmentCharge Amount:",
          jsonData["soap:Envelope"]["soap:Body"][0].GetRate2Response[0]
            .GetRate2Result[0].ServiceLevels[0].ShipmentCharges[0]
            .ShipmentCharge[0].Amount[0]
        );

        return jsonData["soap:Envelope"]["soap:Body"][0].GetRate2Response[0]
          .GetRate2Result[0].ServiceLevels[0].TotalAmount[0];
      } catch (error) {
        console.error("Error fetching or parsing XML:", error);
        throw error;
      }
    };

    try {

    const tarifCharges = await fetchDataAndParseXML();

    console.log('what is the tarif charges', tarifCharges)

    // omygod
    return tarifCharges * 100

    } catch (error) {

      console.error('Error getting total amount:', error);

    }


    return tarifCharges
  };
}

export default Freightcom;
// .$.GetRate2Result[0]
