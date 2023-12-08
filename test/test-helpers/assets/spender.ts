import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import deployments from "../../../src/deployments";
import { deployViaFactory } from "../factories/eip2470";

export default async function (signer: SignerWithAddress) {
  const address = await deployViaFactory(
    { bytecode: creationBytecode, salt },
    signer
  );

  if (address !== deployments.spenderMastercopy.address) {
    throw new Error("Spender did not match deployment");
  }
}

const creationBytecode =
  "0x60806040523480156200001157600080fd5b5060405162003d3e38038062003d3e8339818101604052810190620000379190620005ab565b6000816040516020016200004c9190620005ee565b60405160208183030381529060405290506200006e816200007660201b60201c565b505062000700565b600062000088620002c960201b60201c565b905060008160000160089054906101000a900460ff1615905060008260000160009054906101000a900467ffffffffffffffff1690506000808267ffffffffffffffff16148015620000d75750825b9050600060018367ffffffffffffffff161480156200010d575060003073ffffffffffffffffffffffffffffffffffffffff163b145b9050811580156200011c575080155b1562000154576040517ff92ee8a900000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018560000160006101000a81548167ffffffffffffffff021916908367ffffffffffffffff1602179055508315620001a55760018560000160086101000a81548160ff0219169083151502179055505b600086806020019051810190620001bd919062000650565b9050620001d081620002f160201b60201c565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555062000261620003d060201b60201c565b508315620002c15760008560000160086101000a81548160ff0219169083151502179055507fc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d26001604051620002b89190620006e3565b60405180910390a15b505050505050565b60007ff0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00905090565b6000620003036200051960201b60201c565b905060008160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050828260000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508273ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff1660036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff161462000497576040517fdfd49ebd00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600160036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550565b60007f9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300905090565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000620005738262000546565b9050919050565b620005858162000566565b81146200059157600080fd5b50565b600081519050620005a5816200057a565b92915050565b600060208284031215620005c457620005c362000541565b5b6000620005d48482850162000594565b91505092915050565b620005e88162000566565b82525050565b6000602082019050620006056000830184620005dd565b92915050565b6000620006188262000546565b9050919050565b6200062a816200060b565b81146200063657600080fd5b50565b6000815190506200064a816200061f565b92915050565b60006020828403121562000669576200066862000541565b5b6000620006798482850162000639565b91505092915050565b6000819050919050565b600067ffffffffffffffff82169050919050565b6000819050919050565b6000620006cb620006c5620006bf8462000682565b620006a0565b6200068c565b9050919050565b620006dd81620006aa565b82525050565b6000602082019050620006fa6000830184620006d2565b92915050565b61362e80620007106000396000f3fe608060405234801561001057600080fd5b50600436106101165760003560e01c80638a320255116100a2578063d4b8399211610071578063d4b83992146102cb578063d8afba76146102e9578063e009cfde14610319578063e29dfba814610335578063f2fde38b1461036557610116565b80638a320255146102445780638da5cb5b14610260578063a4f9edbf1461027e578063cc2f84521461029a57610116565b80635aef7de6116100e95780635aef7de6146101c8578063610b5925146101e657806369ecc3cf14610202578063715018a61461021e578063776d1a011461022857610116565b8063086cfca81461011b5780632d9ad53d14610137578063468721a7146101675780635229073f14610197575b600080fd5b610135600480360381019061013091906125bf565b610381565b005b610151600480360381019061014c91906125bf565b61044d565b60405161015e9190612607565b60405180910390f35b610181600480360381019061017c91906126e2565b61051f565b60405161018e9190612607565b60405180910390f35b6101b160048036038101906101ac91906126e2565b6107de565b6040516101bf9291906127fa565b60405180910390f35b6101d0610aa1565b6040516101dd9190612839565b60405180910390f35b61020060048036038101906101fb91906125bf565b610ac5565b005b61021c6004803603810190610217919061288a565b610ddd565b005b610226610e80565b005b610242600480360381019061023d91906125bf565b610e94565b005b61025e600480360381019061025991906128b7565b610f62565b005b6102686113a1565b6040516102759190612839565b60405180910390f35b61029860048036038101906102939190612a62565b6113d9565b005b6102b460048036038101906102af9190612aab565b61160a565b6040516102c2929190612ba9565b60405180910390f35b6102d3611923565b6040516102e09190612839565b60405180910390f35b61030360048036038101906102fe9190612bd9565b611949565b6040516103109190612c48565b60405180910390f35b610333600480360381019061032e9190612c63565b611a45565b005b61034f600480360381019061034a9190612ca3565b611d5c565b60405161035c9190612607565b60405180910390f35b61037f600480360381019061037a91906125bf565b611d8b565b005b610389611e11565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f52ae88b092de36f87fb43fe794eb1381023b9c1bce563a871154022c63dce34260405160405180910390a35050565b60008173ffffffffffffffffffffffffffffffffffffffff16600173ffffffffffffffffffffffffffffffffffffffff16141580156105185750600073ffffffffffffffffffffffffffffffffffffffff16600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614155b9050919050565b60008073ffffffffffffffffffffffffffffffffffffffff16600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16036107d5576000806105be611e98565b91509150600073ffffffffffffffffffffffffffffffffffffffff16600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff160361069257336040517f4a0bfec10000000000000000000000000000000000000000000000000000000081526004016106899190612839565b60405180910390fd5b600260008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060009054906101000a900460ff161561073257816040517f9e1dc0c50000000000000000000000000000000000000000000000000000000081526004016107299190612c48565b60405180910390fd5b6001600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600084815260200190815260200160002060006101000a81548160ff0219169083151502179055507f8c8e19e7e8e193118a05465d7676e82215052d3cb150628fbf598105dc2bb6ab826040516107ca9190612c48565b60405180910390a150505b95945050505050565b60006060600073ffffffffffffffffffffffffffffffffffffffff16600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603610a9757600080610880611e98565b91509150600073ffffffffffffffffffffffffffffffffffffffff16600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff160361095457336040517f4a0bfec100000000000000000000000000000000000000000000000000000000815260040161094b9190612839565b60405180910390fd5b600260008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060009054906101000a900460ff16156109f457816040517f9e1dc0c50000000000000000000000000000000000000000000000000000000081526004016109eb9190612c48565b60405180910390fd5b6001600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600084815260200190815260200160002060006101000a81548160ff0219169083151502179055507f8c8e19e7e8e193118a05465d7676e82215052d3cb150628fbf598105dc2bb6ab82604051610a8c9190612c48565b60405180910390a150505b9550959350505050565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b610acd611e11565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480610b345750600173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16145b15610b7657806040517fb927fe5e000000000000000000000000000000000000000000000000000000008152600401610b6d9190612839565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff16600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610c4657806040517f20618973000000000000000000000000000000000000000000000000000000008152600401610c3d9190612839565b60405180910390fd5b60036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508060036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507fecdf3a3effea5783a3c4c2140e677577666428d44ed9d474a0b3a4c9943f844081604051610dd29190612839565b60405180910390a150565b6001600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060006101000a81548160ff0219169083151502179055507f89a77869d7b8125ba16e08a92ddc8cc26fb1fa47241971167954489a5e66c25581604051610e759190612c48565b60405180910390a150565b610e88611e11565b610e926000612032565b565b610e9c611e11565b6000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f90cc2f570a6eb594b1580ea3e41247d2d73a55281889e86bd4ec2fc29c7e62d660405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff16600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff160361121757600080611000611e98565b91509150600073ffffffffffffffffffffffffffffffffffffffff16600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16036110d457336040517f4a0bfec10000000000000000000000000000000000000000000000000000000081526004016110cb9190612839565b60405180910390fd5b600260008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600083815260200190815260200160002060009054906101000a900460ff161561117457816040517f9e1dc0c500000000000000000000000000000000000000000000000000000000815260040161116b9190612c48565b60405180910390fd5b6001600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600084815260200190815260200160002060006101000a81548160ff0219169083151502179055507f8c8e19e7e8e193118a05465d7676e82215052d3cb150628fbf598105dc2bb6ab8260405161120c9190612c48565b60405180910390a150505b61131e84600063c6fe874760e01b88600063a9059cbb60e01b8989604051602401611243929190612cf2565b604051602081830303815290604052907bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff838183161783525050505060008860016040516024016112ba96959493929190612de4565b604051602081830303815290604052907bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff83818316178352505050506000612109565b61135d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161135490612ea9565b60405180910390fd5b7fca8fbb9bda99848f447971eae62ad0ad2bc7caf9afcc0d8e4e8ffcf7e06bc28f858585856040516113929493929190612ec9565b60405180910390a15050505050565b6000806113ac6121b9565b90508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1691505090565b60006113e36121e1565b905060008160000160089054906101000a900460ff1615905060008260000160009054906101000a900467ffffffffffffffff1690506000808267ffffffffffffffff161480156114315750825b9050600060018367ffffffffffffffff16148015611466575060003073ffffffffffffffffffffffffffffffffffffffff163b145b905081158015611474575080155b156114ab576040517ff92ee8a900000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018560000160006101000a81548167ffffffffffffffff021916908367ffffffffffffffff16021790555083156114fb5760018560000160086101000a81548160ff0219169083151502179055505b6000868060200190518101906115119190612f4c565b905061151c81612032565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506115a5612209565b5083156116025760008560000160086101000a81548160ff0219169083151502179055507fc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d260016040516115f99190612fc8565b60405180910390a15b505050505050565b60606000600173ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614158015611651575061164f8461044d565b155b1561169357836040517fb927fe5e00000000000000000000000000000000000000000000000000000000815260040161168a9190612839565b60405180910390fd5b600083036116cd576040517fe5b7db2e00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8267ffffffffffffffff8111156116e7576116e6612937565b5b6040519080825280602002602001820160405280156117155781602001602082028036833780820191505090505b5091506000600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1691505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16141580156117e75750600173ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614155b80156117f257508381105b156118ba578183828151811061180b5761180a612fe3565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16915080806118b290613041565b91505061177d565b600173ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161461191857826001826118fc9190613089565b8151811061190d5761190c612fe3565b5b602002602001015191505b808352509250929050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000807f47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a7946921860001b463060405160200161198493929190613112565b6040516020818303038152906040528051906020012090506000601960f81b600160f81b837f2939aeeda3ca260200c9f7b436b19e13207547ccc65cfedc857751c5ea6d91d460001b89896040516119dd929190613179565b6040518091039020886040516020016119f893929190613192565b60405160208183030381529060405280519060200120604051602001611a219493929190613237565b60405160208183030381529060405290508080519060200120925050509392505050565b611a4d611e11565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff161480611ab45750600173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16145b15611af657806040517fb927fe5e000000000000000000000000000000000000000000000000000000008152600401611aed9190612839565b60405180910390fd5b8073ffffffffffffffffffffffffffffffffffffffff16600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611bc557806040517f8b4189ff000000000000000000000000000000000000000000000000000000008152600401611bbc9190612839565b60405180910390fd5b600360008273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507faab4fa2b463f581b2b32cb3b7e3b704b9ce37cc209b5fb4d77e593ace405427681604051611d509190612839565b60405180910390a15050565b60026020528160005260406000206020528060005260406000206000915091509054906101000a900460ff1681565b611d93611e11565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603611e055760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401611dfc9190612839565b60405180910390fd5b611e0e81612032565b50565b611e19612351565b73ffffffffffffffffffffffffffffffffffffffff16611e376113a1565b73ffffffffffffffffffffffffffffffffffffffff1614611e9657611e5a612351565b6040517f118cdaa7000000000000000000000000000000000000000000000000000000008152600401611e8d9190612839565b60405180910390fd5b565b6000803660008036915091506065828290501015611ec1576000801b600093509350505061202e565b6000806000611ed08585612359565b9250925092506000606186869050611ee89190613089565b90506000868683908092611efe9392919061328f565b90611f0991906132e2565b905060008560ff1603611fb15760008360001c90506004811080611f2c57508281115b15611f48576000801b600099509950505050505050505061202e565b60008560001c90506000611f6e8a8a6000908692611f689392919061328f565b86611949565b9050611f8c82828c8c87908a92611f879392919061328f565b6123f2565b611f9b576000801b6000611f9e565b80825b9b509b505050505050505050505061202e565b6000611fcf88886000908692611fc99392919061328f565b84611949565b90508060018288888860405160008152602001604052604051611ff59493929190613350565b6020604051602081039080840390855afa158015612017573d6000803e3d6000fd5b505050602060405103519950995050505050505050505b9091565b600061203c6121b9565b905060008160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050828260000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508273ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a3505050565b6000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663468721a7868686866040518563ffffffff1660e01b815260040161216c9493929190613395565b6020604051808303816000875af115801561218b573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906121af919061340d565b9050949350505050565b60007f9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300905090565b60007ff0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00905090565b600073ffffffffffffffffffffffffffffffffffffffff1660036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16146122cf576040517fdfd49ebd00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600160036000600173ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550565b600033905090565b600080600084846001878790506123709190613089565b90809261237f9392919061328f565b9061238a919061343a565b60f81c925084846041878790506123a19190613089565b9080926123b09392919061328f565b906123bb91906132e2565b915084846021878790506123cf9190613089565b9080926123de9392919061328f565b906123e991906132e2565b90509250925092565b600080853b90506000810361240b576000915050612545565b60008673ffffffffffffffffffffffffffffffffffffffff16631626ba7e60e01b878787604051602401612441939291906134c6565b604051602081830303815290604052907bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff83818316178352505050506040516124ab9190613529565b600060405180830381855afa9150503d80600081146124e6576040519150601f19603f3d011682016040523d82523d6000602084013e6124eb565b606091505b50915050631626ba7e60e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19168161252090613591565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614925050505b949350505050565b6000604051905090565b600080fd5b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061258c82612561565b9050919050565b61259c81612581565b81146125a757600080fd5b50565b6000813590506125b981612593565b92915050565b6000602082840312156125d5576125d4612557565b5b60006125e3848285016125aa565b91505092915050565b60008115159050919050565b612601816125ec565b82525050565b600060208201905061261c60008301846125f8565b92915050565b6000819050919050565b61263581612622565b811461264057600080fd5b50565b6000813590506126528161262c565b92915050565b600080fd5b600080fd5b600080fd5b60008083601f84011261267d5761267c612658565b5b8235905067ffffffffffffffff81111561269a5761269961265d565b5b6020830191508360018202830111156126b6576126b5612662565b5b9250929050565b600281106126ca57600080fd5b50565b6000813590506126dc816126bd565b92915050565b6000806000806000608086880312156126fe576126fd612557565b5b600061270c888289016125aa565b955050602061271d88828901612643565b945050604086013567ffffffffffffffff81111561273e5761273d61255c565b5b61274a88828901612667565b9350935050606061275d888289016126cd565b9150509295509295909350565b600081519050919050565b600082825260208201905092915050565b60005b838110156127a4578082015181840152602081019050612789565b60008484015250505050565b6000601f19601f8301169050919050565b60006127cc8261276a565b6127d68185612775565b93506127e6818560208601612786565b6127ef816127b0565b840191505092915050565b600060408201905061280f60008301856125f8565b818103602083015261282181846127c1565b90509392505050565b61283381612581565b82525050565b600060208201905061284e600083018461282a565b92915050565b6000819050919050565b61286781612854565b811461287257600080fd5b50565b6000813590506128848161285e565b92915050565b6000602082840312156128a05761289f612557565b5b60006128ae84828501612875565b91505092915050565b600080600080600060a086880312156128d3576128d2612557565b5b60006128e1888289016125aa565b95505060206128f2888289016125aa565b9450506040612903888289016125aa565b935050606061291488828901612643565b925050608061292588828901612875565b9150509295509295909350565b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61296f826127b0565b810181811067ffffffffffffffff8211171561298e5761298d612937565b5b80604052505050565b60006129a161254d565b90506129ad8282612966565b919050565b600067ffffffffffffffff8211156129cd576129cc612937565b5b6129d6826127b0565b9050602081019050919050565b82818337600083830152505050565b6000612a05612a00846129b2565b612997565b905082815260208101848484011115612a2157612a20612932565b5b612a2c8482856129e3565b509392505050565b600082601f830112612a4957612a48612658565b5b8135612a598482602086016129f2565b91505092915050565b600060208284031215612a7857612a77612557565b5b600082013567ffffffffffffffff811115612a9657612a9561255c565b5b612aa284828501612a34565b91505092915050565b60008060408385031215612ac257612ac1612557565b5b6000612ad0858286016125aa565b9250506020612ae185828601612643565b9150509250929050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b612b2081612581565b82525050565b6000612b328383612b17565b60208301905092915050565b6000602082019050919050565b6000612b5682612aeb565b612b608185612af6565b9350612b6b83612b07565b8060005b83811015612b9c578151612b838882612b26565b9750612b8e83612b3e565b925050600181019050612b6f565b5085935050505092915050565b60006040820190508181036000830152612bc38185612b4b565b9050612bd2602083018461282a565b9392505050565b600080600060408486031215612bf257612bf1612557565b5b600084013567ffffffffffffffff811115612c1057612c0f61255c565b5b612c1c86828701612667565b93509350506020612c2f86828701612875565b9150509250925092565b612c4281612854565b82525050565b6000602082019050612c5d6000830184612c39565b92915050565b60008060408385031215612c7a57612c79612557565b5b6000612c88858286016125aa565b9250506020612c99858286016125aa565b9150509250929050565b60008060408385031215612cba57612cb9612557565b5b6000612cc8858286016125aa565b9250506020612cd985828601612875565b9150509250929050565b612cec81612622565b82525050565b6000604082019050612d07600083018561282a565b612d146020830184612ce3565b9392505050565b6000819050919050565b600060ff82169050919050565b6000819050919050565b6000612d57612d52612d4d84612d1b565b612d32565b612d25565b9050919050565b612d6781612d3c565b82525050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b60028110612dad57612dac612d6d565b5b50565b6000819050612dbe82612d9c565b919050565b6000612dce82612db0565b9050919050565b612dde81612dc3565b82525050565b600060c082019050612df9600083018961282a565b612e066020830188612d5e565b8181036040830152612e1881876127c1565b9050612e276060830186612dd5565b612e346080830185612c39565b612e4160a08301846125f8565b979650505050505050565b600082825260208201905092915050565b7f5370656e64205472616e73616374696f6e204661696c65640000000000000000600082015250565b6000612e93601883612e4c565b9150612e9e82612e5d565b602082019050919050565b60006020820190508181036000830152612ec281612e86565b9050919050565b6000608082019050612ede600083018761282a565b612eeb602083018661282a565b612ef8604083018561282a565b612f056060830184612ce3565b95945050505050565b6000612f1982612561565b9050919050565b612f2981612f0e565b8114612f3457600080fd5b50565b600081519050612f4681612f20565b92915050565b600060208284031215612f6257612f61612557565b5b6000612f7084828501612f37565b91505092915050565b6000819050919050565b600067ffffffffffffffff82169050919050565b6000612fb2612fad612fa884612f79565b612d32565b612f83565b9050919050565b612fc281612f97565b82525050565b6000602082019050612fdd6000830184612fb9565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061304c82612622565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361307e5761307d613012565b5b600182019050919050565b600061309482612622565b915061309f83612622565b92508282039050818111156130b7576130b6613012565b5b92915050565b60006130d86130d36130ce84612561565b612d32565b612561565b9050919050565b60006130ea826130bd565b9050919050565b60006130fc826130df565b9050919050565b61310c816130f1565b82525050565b60006060820190506131276000830186612c39565b6131346020830185612ce3565b6131416040830184613103565b949350505050565b600081905092915050565b60006131608385613149565b935061316d8385846129e3565b82840190509392505050565b6000613186828486613154565b91508190509392505050565b60006060820190506131a76000830186612c39565b6131b46020830185612c39565b6131c16040830184612c39565b949350505050565b60007fff0000000000000000000000000000000000000000000000000000000000000082169050919050565b6000819050919050565b61321061320b826131c9565b6131f5565b82525050565b6000819050919050565b61323161322c82612854565b613216565b82525050565b600061324382876131ff565b60018201915061325382866131ff565b6001820191506132638285613220565b6020820191506132738284613220565b60208201915081905095945050505050565b600080fd5b600080fd5b600080858511156132a3576132a2613285565b5b838611156132b4576132b361328a565b5b6001850283019150848603905094509492505050565b600082905092915050565b600082821b905092915050565b60006132ee83836132ca565b826132f98135612854565b92506020821015613339576133347fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff836020036008026132d5565b831692505b505092915050565b61334a81612d25565b82525050565b60006080820190506133656000830187612c39565b6133726020830186613341565b61337f6040830185612c39565b61338c6060830184612c39565b95945050505050565b60006080820190506133aa600083018761282a565b6133b76020830186612ce3565b81810360408301526133c981856127c1565b90506133d86060830184612dd5565b95945050505050565b6133ea816125ec565b81146133f557600080fd5b50565b600081519050613407816133e1565b92915050565b60006020828403121561342357613422612557565b5b6000613431848285016133f8565b91505092915050565b600061344683836132ca565b8261345181356131c9565b925060018210156134915761348c7fff00000000000000000000000000000000000000000000000000000000000000836001036008026132d5565b831692505b505092915050565b60006134a58385612775565b93506134b28385846129e3565b6134bb836127b0565b840190509392505050565b60006040820190506134db6000830186612c39565b81810360208301526134ee818486613499565b9050949350505050565b60006135038261276a565b61350d8185613149565b935061351d818560208601612786565b80840191505092915050565b600061353582846134f8565b915081905092915050565b6000819050602082019050919050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b60006135888251613550565b80915050919050565b600061359c8261276a565b826135a684613540565b90506135b18161357c565b925060048210156135f1576135ec7fffffffff00000000000000000000000000000000000000000000000000000000836004036008026132d5565b831692505b505091905056fea264697066735822122097e9c187f07533fd28041c4ea588af2e3bd765fe3a08cd9ccdf43e4aa558c01e64736f6c634300081400330000000000000000000000000000000000000000000000000000000000000001";
const salt =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
