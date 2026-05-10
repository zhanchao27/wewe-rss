import {
  Badge,
  Image,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Tooltip,
} from '@nextui-org/react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useLocation } from 'react-router-dom';
import { appVersion, serverOriginUrl } from '@web/utils/env';

const navbarItemLink = [
  {
    href: '/feeds',
    name: '公众号源',
  },
  {
    href: '/accounts',
    name: '账号管理',
  },
  // {
  //   href: '/settings',
  //   name: '设置',
  // },
];

const Nav = () => {
  const { pathname } = useLocation();

  return (
    <div>
      <Navbar isBordered>
        <Tooltip
          content={
            <div className="p-1">
              当前版本: v{appVersion}
            </div>
          }
          placement="left"
        >
          <NavbarBrand className="cursor-default">
            <Image
              width={28}
              alt="WeWe RSS"
              className="mr-2"
              src={
                serverOriginUrl
                  ? `${serverOriginUrl}/favicon.ico`
                  : 'https://r2-assets.111965.xyz/wewe-rss.png'
              }
            ></Image>
            <p className="font-bold text-inherit">WeWe RSS</p>
          </NavbarBrand>
        </Tooltip>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {navbarItemLink.map((item) => {
            return (
              <NavbarItem
                isActive={pathname.startsWith(item.href)}
                key={item.href}
              >
                <Link color="foreground" href={item.href}>
                  {item.name}
                </Link>
              </NavbarItem>
            );
          })}
        </NavbarContent>
        <NavbarContent justify="end">
          <ThemeSwitcher></ThemeSwitcher>
        </NavbarContent>
      </Navbar>
    </div>
  );
};

export default Nav;
