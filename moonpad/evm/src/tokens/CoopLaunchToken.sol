// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Base} from "../base/ERC20Base.sol";

/// @notice The launch token — a fully clean, immutable ERC20. No owner, no mint
/// function beyond the constructor, no taxes, no pause, no blacklist. Platform and
/// creator revenue comes from the locked Uniswap v3 position's fee stream (see
/// CoopLocker), never from the token itself.
///
/// The only lifecycle hook: until the bonding curve completes, tokens can move only
/// to/from the launchpad, which prevents seeding a parallel pool mid-curve. After
/// `graduate()` the token is a plain ERC20 forever.
contract CoopLaunchToken is ERC20Base {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    address public immutable launchpad;
    string public metadataURI;
    bool public graduated;

    constructor(string memory name_, string memory symbol_, string memory metadataURI_)
        ERC20Base(name_, symbol_)
    {
        launchpad = msg.sender;
        metadataURI = metadataURI_;
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function graduate() external {
        require(msg.sender == launchpad, "CoopToken: not launchpad");
        graduated = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!graduated && from != address(0)) {
            require(from == launchpad || to == launchpad, "CoopToken: locked until graduation");
        }
        super._update(from, to, value);
    }
}
