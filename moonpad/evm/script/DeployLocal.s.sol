// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CoopLaunchpad} from "../src/CoopLaunchpad.sol";
import {WETH9Mock} from "../test/mocks/WETH9Mock.sol";

/// @notice Full local/testnet stack: WETH mock, real Uniswap v3 factory (vendored
/// bytecode), and the launchpad (which deploys its own locker).
///
///   anvil                                   # terminal 1
///   npm run evm:local                       # terminal 2 (from moonpad/)
contract DeployLocalStack is Script {
    function run() external {
        vm.startBroadcast();

        WETH9Mock weth = new WETH9Mock();
        address factory = _create(vm.getCode("UniswapV3Factory.sol:UniswapV3Factory"), "");
        CoopLaunchpad launchpad = new CoopLaunchpad(factory, address(weth), msg.sender);

        vm.stopBroadcast();

        console.log("WETH9Mock:        ", address(weth));
        console.log("UniswapV3Factory: ", factory);
        console.log("CoopLaunchpad:    ", address(launchpad));
        console.log("CoopLocker:       ", address(launchpad.locker()));
        console.log("");
        console.log("NEXT_PUBLIC_LAUNCHPAD_ADDRESS=%s", address(launchpad));
    }

    function _create(bytes memory code, bytes memory args) private returns (address addr) {
        bytes memory bytecode = abi.encodePacked(code, args);
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "create failed");
    }
}
